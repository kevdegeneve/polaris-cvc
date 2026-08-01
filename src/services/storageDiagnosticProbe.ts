import { ref, uploadBytes } from "firebase/storage";
import { createFirebaseServices } from "./firebaseClient";

export interface StorageDiagnosticProbeInput {
  diagnosticId: string;
  photoId?: string;
}

export interface StorageDiagnosticProbeResult {
  storagePath: string;
  storageBucket: string;
  projectId: string;
  authUid: string;
  size: number;
  mimeType: string;
}

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lzL2YQAAAABJRU5ErkJggg==";

export async function runStorageDiagnosticProbe(input: StorageDiagnosticProbeInput): Promise<StorageDiagnosticProbeResult> {
  const firebase = createFirebaseServices();
  if (!firebase) throw new Error("Firebase n'est pas configure.");
  const bytes = Uint8Array.from(atob(tinyPngBase64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: "image/png" });
  const photoId = input.photoId || `storage-probe-${crypto.randomUUID()}`;
  const storagePath = `diagnostics/${input.diagnosticId}/photos/${photoId}.png`;
  const storageRef = ref(firebase.storage, storagePath);
  await uploadBytes(storageRef, blob, {
    contentType: "image/png",
    customMetadata: {
      diagnosticId: input.diagnosticId,
      photoId,
      category: "storage_probe"
    }
  });
  return {
    storagePath,
    storageBucket: firebase.storage.app.options.storageBucket || "unknown",
    projectId: firebase.app.options.projectId || "unknown",
    authUid: firebase.auth.currentUser?.uid || "anonymous",
    size: blob.size,
    mimeType: blob.type
  };
}
