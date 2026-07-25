import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import type { DiagnosticPhoto } from "../domain/types";
import { createFirebaseServices } from "./firebaseClient";

export const allowedDiagnosticImageTypes = ["image/jpeg", "image/png", "image/webp"];
export const diagnosticImageMaxSize = 10 * 1024 * 1024;

export interface DiagnosticUploadProgress {
  photoId: string;
  progress: number;
}

export function validateDiagnosticImage(file: File): void {
  if (!allowedDiagnosticImageTypes.includes(file.type)) {
    throw new Error("Format image non autorise. Utilisez JPEG, PNG ou WebP.");
  }
  if (file.size > diagnosticImageMaxSize) {
    throw new Error("Image trop volumineuse. Taille maximale : 10 Mo.");
  }
}

export async function uploadDiagnosticPhoto(
  photo: DiagnosticPhoto,
  file: File,
  onProgress: (progress: DiagnosticUploadProgress) => void
): Promise<Pick<DiagnosticPhoto, "downloadUrl" | "storagePath">> {
  validateDiagnosticImage(file);
  const firebase = createFirebaseServices();
  if (!firebase) throw new Error("Firebase Storage n'est pas configure.");

  const storageRef = ref(firebase.storage, photo.storagePath);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      diagnosticId: photo.diagnosticId,
      photoId: photo.id,
      category: photo.category
    }
  });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        onProgress({
          photoId: photo.id,
          progress: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        });
      },
      (error) => reject(error),
      async () => {
        resolve({
          storagePath: photo.storagePath,
          downloadUrl: await getDownloadURL(task.snapshot.ref)
        });
      }
    );
  });
}
