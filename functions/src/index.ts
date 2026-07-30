import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import { createHash } from "node:crypto";
import { DIAGNOSTIC_MODEL, DIAGNOSTIC_PROMPT_VERSION, buildDiagnosticPrompt } from "./prompt.js";
import { buildArchiveTitle } from "./result.js";
import type { DiagnosticAIResult, DiagnosticPhotoRecord, DiagnosticRecord, OpenAIDiagnosticPayload, UserProfileRecord } from "./types.js";
import { isPreferredLanguage, removeUndefinedFields, validateDiagnosticAIResult, validateOpenAIDiagnosticPayload } from "./validation.js";

initializeApp();

const openAiApiKey = defineSecret("OPENAI_API_KEY");
const db = getFirestore();
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 10 * 1024 * 1024;
const diagnosticResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "polaris_diagnostic_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "detectedBrand",
        "detectedModel",
        "detectedSerialNumber",
        "detectedEquipmentType",
        "detectedErrorCode",
        "plateExtractedText",
        "faultImageExtractedText",
        "faultDescription",
        "probableCauses",
        "recommendedChecks",
        "expectedMeasurements",
        "safetyWarnings",
        "suggestedSolutions",
        "missingInformation",
        "confidenceLevel",
        "analysisLanguage",
        "sourceReferences"
      ],
      properties: {
        detectedBrand: { type: ["string", "null"] },
        detectedModel: { type: ["string", "null"] },
        detectedSerialNumber: { type: ["string", "null"] },
        detectedEquipmentType: { type: ["string", "null"] },
        detectedErrorCode: { type: ["string", "null"] },
        plateExtractedText: { type: "array", items: { type: "string" } },
        faultImageExtractedText: { type: "array", items: { type: "string" } },
        faultDescription: { type: ["string", "null"] },
        probableCauses: { type: "array", items: { type: "string" } },
        recommendedChecks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "instruction", "reason", "expectedResult", "safetyLevel", "order"],
            properties: {
              title: { type: "string" },
              instruction: { type: "string" },
              reason: { type: "string" },
              expectedResult: { type: "string" },
              safetyLevel: { type: "string", enum: ["low", "medium", "high"] },
              order: { type: "number" }
            }
          }
        },
        expectedMeasurements: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["measurement", "location", "expectedValue", "unit", "tolerance", "conditions"],
            properties: {
              measurement: { type: "string" },
              location: { type: "string" },
              expectedValue: { type: "string" },
              unit: { type: ["string", "null"] },
              tolerance: { type: ["string", "null"] },
              conditions: { type: ["string", "null"] }
            }
          }
        },
        safetyWarnings: { type: "array", items: { type: "string" } },
        suggestedSolutions: { type: "array", items: { type: "string" } },
        missingInformation: { type: "array", items: { type: "string" } },
        confidenceLevel: { type: "number", minimum: 0, maximum: 1 },
        analysisLanguage: { type: "string", enum: ["fr", "en", "de", "it", "es"] },
        sourceReferences: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "documentId",
              "title",
              "manufacturer",
              "originalLanguage",
              "displayedLanguage",
              "sourceUrl",
              "documentReference",
              "documentVersion",
              "pagesUsed",
              "sectionsUsed",
              "excerptsUsed",
              "hash",
              "verificationStatus"
            ],
            properties: {
              documentId: { type: ["string", "null"] },
              title: { type: "string" },
              manufacturer: { type: ["string", "null"] },
              originalLanguage: { type: ["string", "null"] },
              displayedLanguage: { type: ["string", "null"] },
              sourceUrl: { type: ["string", "null"] },
              documentReference: { type: ["string", "null"] },
              documentVersion: { type: ["string", "null"] },
              pagesUsed: { type: "array", items: { type: "string" } },
              sectionsUsed: { type: "array", items: { type: "string" } },
              excerptsUsed: { type: "array", items: { type: "string" } },
              hash: { type: ["string", "null"] },
              verificationStatus: { type: ["string", "null"], enum: ["a_verifier", "verifie", "rejete", null] }
            }
          }
        }
      }
    }
  }
};

export const analyzeDiagnostic = onCall(
  {
    region: "europe-west1",
    secrets: [openAiApiKey],
    timeoutSeconds: 120,
    memory: "1GiB"
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");
    const diagnosticId = readDiagnosticId(request.data);
    const uid = request.auth.uid;

    const user = await readActiveUser(uid);
    await readActiveAuthorization(user);
    const diagnosticRef = db.collection("diagnostics").doc(diagnosticId);
    const photosQuery = db.collection("diagnosticPhotos").where("diagnosticId", "==", diagnosticId);

    await db.runTransaction(async (transaction) => {
      const diagnosticSnap = await transaction.get(diagnosticRef);
      if (!diagnosticSnap.exists) throw new HttpsError("not-found", "Diagnostic introuvable.");
      const diagnostic = { id: diagnosticSnap.id, ...diagnosticSnap.data() } as DiagnosticRecord;
      assertDiagnosticAccess(diagnostic, user, uid);
      if (diagnostic.status === "archived") throw new HttpsError("failed-precondition", "Diagnostic deja archive.");
      if (diagnostic.status === "analyzing") throw new HttpsError("aborted", "Une analyse est deja en cours.");
      if ((diagnostic.analysisAttemptCount || 0) >= 2 && !isAdmin(user)) {
        throw new HttpsError("resource-exhausted", "Nombre maximal d'analyses atteint pour ce diagnostic.");
      }
      transaction.update(diagnosticRef, {
        status: "analyzing",
        analysisStartedAt: new Date().toISOString(),
        analysisRequestedBy: uid,
        analysisAttemptCount: (diagnostic.analysisAttemptCount || 0) + 1,
        updatedAt: new Date().toISOString()
      });
    });

    try {
      const diagnosticSnap = await diagnosticRef.get();
      const diagnostic = { id: diagnosticSnap.id, ...diagnosticSnap.data() } as DiagnosticRecord;
      assertDiagnosticAccess(diagnostic, user, uid);
      const photos = (await photosQuery.get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }) as DiagnosticPhotoRecord);
      const requiredPhotos = selectRequiredPhotos(photos, diagnosticId);
      const loadedPhotos = await Promise.all(requiredPhotos.map(loadPhoto));
      const photoSignature = createHash("sha256")
        .update(loadedPhotos.map((photo) => `${photo.path}:${photo.hash}`).join("|"))
        .update(DIAGNOSTIC_PROMPT_VERSION)
        .digest("hex");

      if (diagnostic.analyzedPhotoSignature === photoSignature) {
        throw new HttpsError("already-exists", "Ces photos ont deja ete analysees avec cette version du prompt.");
      }

      const language = isPreferredLanguage(user.preferredLanguage) ? user.preferredLanguage : "fr";
      const result = await analyzeWithOpenAI(loadedPhotos, language);
      const finalResult: DiagnosticAIResult = {
        ...result,
        analyzedAt: new Date().toISOString(),
        modelUsed: DIAGNOSTIC_MODEL,
        promptVersion: DIAGNOSTIC_PROMPT_VERSION,
        sourceReferences: result.sourceReferences || []
      };
      const validated = validateDiagnosticAIResult(finalResult);
      const title = buildArchiveTitle(validated);

      await diagnosticRef.set(
        removeUndefinedFields({
          title,
          status: "awaiting_technician_input",
          detectedBrand: validated.detectedBrand || undefined,
          detectedModel: validated.detectedModel || undefined,
          detectedSerialNumber: validated.detectedSerialNumber || undefined,
          detectedEquipmentType: validated.detectedEquipmentType || undefined,
          detectedErrorCode: validated.detectedErrorCode || undefined,
          shortFaultDescription: validated.faultDescription || undefined,
          probableCauses: validated.probableCauses,
          recommendedChecks: validated.recommendedChecks,
          expectedMeasurements: validated.expectedMeasurements,
          proposedSolutions: validated.suggestedSolutions,
          safetyWarnings: validated.safetyWarnings,
          confidenceLevel: validated.confidenceLevel,
          sourceReferences: validated.sourceReferences,
          documentIds: validated.sourceReferences.map((source) => source.documentId).filter(Boolean),
          analysisResult: validated,
          analysisSummary: validated.faultDescription || undefined,
          analysisCompletedAt: validated.analyzedAt,
          analyzedPhotoSignature: photoSignature,
          promptVersion: DIAGNOSTIC_PROMPT_VERSION,
          modelUsed: DIAGNOSTIC_MODEL,
          updatedAt: new Date().toISOString()
        }),
        { merge: true }
      );

      await Promise.all(requiredPhotos.map((photo) => db.collection("diagnosticPhotos").doc(photo.id).set({ analysisStatus: "analyzed", updatedAt: new Date().toISOString() }, { merge: true })));

      console.info("diagnostic_analysis_completed", {
        diagnosticId,
        uid: uid.slice(0, 8),
        model: DIAGNOSTIC_MODEL,
        imageCount: loadedPhotos.length
      });

      return {
        status: "completed",
        message: "Analyse terminee.",
        analysis: {
          result: validated,
          detectedBrand: validated.detectedBrand,
          detectedModel: validated.detectedModel,
          detectedErrorCode: validated.detectedErrorCode,
          shortFaultDescription: validated.faultDescription,
          sourceReferences: validated.sourceReferences,
          confidenceLevel: validated.confidenceLevel
        }
      };
    } catch (error) {
      await diagnosticRef.set(
        {
          status: "analysis_failed",
          analysisError: error instanceof HttpsError ? error.message : "Analyse impossible pour le moment.",
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      if (error instanceof HttpsError) throw error;
      console.error("diagnostic_analysis_failed", { diagnosticId, uid: uid.slice(0, 8), code: error instanceof Error ? error.message : "unknown" });
      throw new HttpsError("internal", "Analyse impossible pour le moment.");
    }
  }
);

function readDiagnosticId(data: unknown): string {
  if (typeof data !== "object" || data === null || !("diagnosticId" in data) || typeof data.diagnosticId !== "string") {
    throw new HttpsError("invalid-argument", "diagnosticId requis.");
  }
  if (data.diagnosticId.length > 120) throw new HttpsError("invalid-argument", "diagnosticId invalide.");
  return data.diagnosticId;
}

async function readActiveUser(uid: string): Promise<UserProfileRecord> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "Profil utilisateur introuvable.");
  const user = { uid, ...snap.data() } as UserProfileRecord;
  if (user.isActive !== true) throw new HttpsError("permission-denied", "Utilisateur desactive.");
  return user;
}

async function readActiveAuthorization(user: UserProfileRecord): Promise<void> {
  if (typeof user.emailNormalized !== "string" || !user.emailNormalized) {
    throw new HttpsError("permission-denied", "Email utilisateur non verifie.");
  }
  const snap = await db.collection("authorizedUsers").doc(user.emailNormalized).get();
  if (!snap.exists || snap.get("isActive") !== true || snap.get("companyId") !== user.companyId || snap.get("role") !== user.role) {
    throw new HttpsError("permission-denied", "Utilisateur non autorise.");
  }
}

function assertDiagnosticAccess(diagnostic: DiagnosticRecord, user: UserProfileRecord, uid: string): void {
  if (diagnostic.companyId !== user.companyId) throw new HttpsError("permission-denied", "Diagnostic hors entreprise.");
  if (diagnostic.technicianId !== uid && !isAdmin(user)) throw new HttpsError("permission-denied", "Diagnostic non accessible.");
}

function isAdmin(user: UserProfileRecord): boolean {
  return user.role === "admin" || user.role === "administrateur";
}

function selectRequiredPhotos(photos: DiagnosticPhotoRecord[], diagnosticId: string): [DiagnosticPhotoRecord, DiagnosticPhotoRecord] {
  const plate = photos.find((photo) => photo.category === "plaque_signaletique");
  const fault = photos.find((photo) => photo.category === "code_erreur");
  if (!plate || !fault) throw new HttpsError("failed-precondition", "Les deux photos obligatoires sont requises.");
  for (const photo of [plate, fault]) {
    if (!photo.storagePath.startsWith(`diagnostics/${diagnosticId}/photos/`)) throw new HttpsError("permission-denied", "Chemin Storage invalide.");
    if (!allowedMimeTypes.includes(photo.mimeType)) throw new HttpsError("invalid-argument", "Type MIME invalide.");
    if (photo.size > maxImageSize) throw new HttpsError("invalid-argument", "Image trop volumineuse.");
  }
  return [plate, fault];
}

async function loadPhoto(photo: DiagnosticPhotoRecord): Promise<{ path: string; mimeType: string; base64: string; hash: string }> {
  const file = getStorage().bucket().file(photo.storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Fichier image introuvable.");
  const [metadata] = await file.getMetadata();
  if (!allowedMimeTypes.includes(String(metadata.contentType))) throw new HttpsError("invalid-argument", "Type MIME Storage invalide.");
  const [buffer] = await file.download();
  if (buffer.byteLength > maxImageSize) throw new HttpsError("invalid-argument", "Image trop volumineuse.");
  return {
    path: photo.storagePath,
    mimeType: String(metadata.contentType),
    base64: buffer.toString("base64"),
    hash: createHash("sha256").update(buffer).digest("hex")
  };
}

async function analyzeWithOpenAI(
  photos: Array<{ mimeType: string; base64: string }>,
  language: UserProfileRecord["preferredLanguage"]
): Promise<OpenAIDiagnosticPayload> {
  const apiKey = openAiApiKey.value();
  if (!apiKey) throw new HttpsError("failed-precondition", "Secret OPENAI_API_KEY absent.");
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: DIAGNOSTIC_MODEL,
    response_format: diagnosticResponseFormat,
    messages: [
      { role: "system", content: buildDiagnosticPrompt(language || "fr") },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze these two HVAC diagnostic images. First image is the nameplate, second image is the fault or error code. Return strict JSON only." },
          ...photos.map((photo) => ({
            type: "image_url" as const,
            image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` }
          }))
        ]
      }
    ]
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("empty_openai_response");
  return validateOpenAIDiagnosticPayload(JSON.parse(content) as unknown);
}
