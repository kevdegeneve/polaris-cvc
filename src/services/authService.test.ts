import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_DISABLED_MESSAGE,
  ACCESS_NOT_AUTHORIZED_MESSAGE,
  AuthAccessDeniedError,
  buildAuthorizedUser,
  canManageAuthorizedUsers,
  createUserProfileData,
  disableAuthorizedUser,
  ensureUserProfile,
  inviteAuthorizedUser,
  normalizeAuthorizedEmail,
  signInWithGoogle,
  signOutCurrentSession,
  type AuthSession
} from "./authService";

const firebaseMocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn((db: unknown, collectionName: string, id: string) => ({ db, collectionName, id })),
  collection: vi.fn((db: unknown, collectionName: string) => ({ db, collectionName })),
  signOut: vi.fn(),
  signInWithPopup: vi.fn()
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(() => ({ setCustomParameters: vi.fn() })),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: firebaseMocks.signInWithPopup,
  signOut: firebaseMocks.signOut
}));

vi.mock("firebase/firestore", () => ({
  collection: firebaseMocks.collection,
  doc: firebaseMocks.doc,
  getDoc: firebaseMocks.getDoc,
  getDocs: firebaseMocks.getDocs,
  setDoc: firebaseMocks.setDoc,
  updateDoc: firebaseMocks.updateDoc
}));

vi.mock("./firebaseClient", () => ({
  createFirebaseServices: () => ({ auth: { name: "auth" }, db: { name: "db" }, app: {}, storage: {} })
}));

const activeAuthorization = buildAuthorizedUser("tech@example.com", "company-a", "technician", true);
const adminSession: AuthSession = {
  mode: "firebase",
  userId: "admin-uid",
  email: "admin@example.com",
  emailNormalized: "admin@example.com",
  displayName: "Admin",
  role: "admin",
  companyId: "company-a"
};
const technicianSession: AuthSession = { ...adminSession, role: "technician", userId: "tech-uid" };

function snap(exists: boolean, data: unknown = {}) {
  return { exists: () => exists, data: () => data };
}

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes authorized user email ids", () => {
    expect(normalizeAuthorizedEmail(" TECH@Example.COM ")).toBe("tech@example.com");
  });

  it("grants access when the email is actively authorized", async () => {
    firebaseMocks.getDoc.mockResolvedValueOnce(snap(true, activeAuthorization));
    firebaseMocks.getDoc.mockResolvedValueOnce(snap(false));

    const session = await ensureUserProfile({
      uid: "uid-1",
      email: "tech@example.com",
      displayName: "Tech",
      photoURL: "https://example.test/photo.jpg"
    } as never);

    expect(session.companyId).toBe("company-a");
    expect(session.role).toBe("technician");
    expect(firebaseMocks.setDoc).toHaveBeenCalledOnce();
    const [, writtenProfile] = firebaseMocks.setDoc.mock.calls[0];
    expect(writtenProfile).not.toHaveProperty("preferredLanguage");
    expect(writtenProfile).not.toHaveProperty("preferredLanguageLabel");
    expect(writtenProfile).not.toHaveProperty("languageConfiguredAt");
  });

  it("refuses access when the email is not authorized", async () => {
    firebaseMocks.getDoc.mockResolvedValueOnce(snap(false));

    await expect(
      ensureUserProfile({ uid: "uid-1", email: "unknown@example.com", displayName: "Unknown", photoURL: null } as never)
    ).rejects.toMatchObject({ message: ACCESS_NOT_AUTHORIZED_MESSAGE });
    expect(firebaseMocks.setDoc).not.toHaveBeenCalled();
  });

  it("refuses access when authorization is disabled", async () => {
    firebaseMocks.getDoc.mockResolvedValueOnce(snap(true, { ...activeAuthorization, isActive: false }));

    await expect(
      ensureUserProfile({ uid: "uid-1", email: "tech@example.com", displayName: "Tech", photoURL: null } as never)
    ).rejects.toMatchObject({ message: ACCESS_DISABLED_MESSAGE });
  });

  it("refuses access when the existing user profile is disabled", async () => {
    firebaseMocks.getDoc.mockResolvedValueOnce(snap(true, activeAuthorization));
    firebaseMocks.getDoc.mockResolvedValueOnce(snap(true, { isActive: false, createdAt: "2026-01-01T00:00:00.000Z" }));

    await expect(
      ensureUserProfile({ uid: "uid-1", email: "tech@example.com", displayName: "Tech", photoURL: null } as never)
    ).rejects.toMatchObject({ message: ACCESS_DISABLED_MESSAGE });
  });

  it("never assigns admin or optima automatically", () => {
    const profile = createUserProfileData(
      { uid: "uid-1", email: "tech@example.com", displayName: "Tech", photoURL: null } as never,
      activeAuthorization,
      null,
      "2026-07-17T10:00:00.000Z"
    );

    expect(profile.role).toBe("technician");
    expect(profile.companyId).toBe("company-a");
  });

  it("keeps createdAt and updates lastLoginAt", () => {
    const profile = createUserProfileData(
      { uid: "uid-1", email: "tech@example.com", displayName: "Tech", photoURL: null } as never,
      activeAuthorization,
      { createdAt: "2026-01-01T00:00:00.000Z", isActive: true },
      "2026-07-17T10:00:00.000Z"
    );

    expect(profile.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(profile.lastLoginAt).toBe("2026-07-17T10:00:00.000Z");
  });

  it("keeps the configured preferred language on later logins", () => {
    const profile = createUserProfileData(
      { uid: "uid-1", email: "tech@example.com", displayName: "Tech", photoURL: null } as never,
      activeAuthorization,
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        preferredLanguage: "fr",
        preferredLanguageLabel: "Francais",
        languageConfiguredAt: "2026-01-02T00:00:00.000Z"
      },
      "2026-07-17T10:00:00.000Z"
    );

    expect(profile.preferredLanguage).toBe("fr");
    expect(profile.preferredLanguageLabel).toBe("Francais");
    expect(profile.languageConfiguredAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("omits unsupported preferred language values from the profile", () => {
    const profile = createUserProfileData(
      { uid: "uid-1", email: "tech@example.com", displayName: "Tech", photoURL: null } as never,
      activeAuthorization,
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        preferredLanguage: "jp",
        preferredLanguageLabel: "Japanese",
        languageConfiguredAt: "2026-01-02T00:00:00.000Z"
      },
      "2026-07-17T10:00:00.000Z"
    );

    expect(profile).not.toHaveProperty("preferredLanguage");
    expect(profile).not.toHaveProperty("preferredLanguageLabel");
    expect(profile).not.toHaveProperty("languageConfiguredAt");
  });

  it("signs out after a refused Google login", async () => {
    firebaseMocks.signInWithPopup.mockResolvedValueOnce({
      user: { uid: "uid-1", email: "unknown@example.com", displayName: "Unknown", photoURL: null }
    });
    firebaseMocks.getDoc.mockResolvedValueOnce(snap(false));

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(AuthAccessDeniedError);
    expect(firebaseMocks.signOut).toHaveBeenCalledWith({ name: "auth" });
  });

  it("signs out through Firebase", async () => {
    firebaseMocks.signOut.mockResolvedValueOnce(undefined);

    await signOutCurrentSession();

    expect(firebaseMocks.signOut).toHaveBeenCalledWith({ name: "auth" });
  });

  it("prevents technicians from managing authorizations", async () => {
    expect(canManageAuthorizedUsers(technicianSession)).toBe(false);
    await expect(inviteAuthorizedUser(technicianSession, buildAuthorizedUser("new@example.com", "company-a", "technician"))).rejects.toThrow(
      "administrateur"
    );
  });

  it("allows active admins to manage authorizations", async () => {
    expect(canManageAuthorizedUsers(adminSession)).toBe(true);
    await inviteAuthorizedUser(adminSession, buildAuthorizedUser("new@example.com", "company-a", "technician"));
    await disableAuthorizedUser(adminSession, "new@example.com");

    expect(firebaseMocks.setDoc).toHaveBeenCalledOnce();
    expect(firebaseMocks.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ collectionName: "authorizedUsers" }), expect.objectContaining({ isActive: false }));
  });
});
