import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import type { DiagnosticPhoto } from "../domain/types";
import { createFirebaseServices } from "./firebaseClient";

export const allowedDiagnosticImageTypes = ["image/jpeg", "image/png", "image/webp"];
export const diagnosticImageMaxSize = 10 * 1024 * 1024;
export const diagnosticUploadTimeoutMs = 30_000;
export const diagnosticImageMaxDimension = 1800;
export const diagnosticImageQuality = 0.86;

export interface DiagnosticUploadProgress {
  photoId: string;
  progress: number;
}

export interface DiagnosticUploadOptions {
  timeoutMs?: number;
  onEvent?: (event: string, details: Record<string, unknown>) => void;
}

export function validateDiagnosticImage(file: File): void {
  if (!allowedDiagnosticImageTypes.includes(file.type)) {
    throw new Error("Format image non autorise. Utilisez JPEG, PNG ou WebP.");
  }
  if (file.size > diagnosticImageMaxSize) {
    throw new Error("Image trop volumineuse. Taille maximale : 10 Mo.");
  }
}

export function getResizedDimensions(width: number, height: number, maxDimension = diagnosticImageMaxDimension): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio)
  };
}

export async function prepareDiagnosticImage(file: File): Promise<File> {
  validateDiagnosticImage(file);
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createBitmap(file);
    const dimensions = getResizedDimensions(bitmap.width, bitmap.height);
    if (dimensions.width === bitmap.width && dimensions.height === bitmap.height && file.type !== "image/png") return file;
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    const blob = await canvasToBlob(canvas, "image/jpeg", diagnosticImageQuality);
    if (!blob) return file;
    const prepared = new File([blob], normalizePreparedFileName(file.name), { type: "image/jpeg", lastModified: Date.now() });
    validateDiagnosticImage(prepared);
    return prepared.size < file.size || file.size > diagnosticImageMaxSize * 0.6 ? prepared : file;
  } catch {
    return file;
  }
}

export async function uploadDiagnosticPhoto(
  photo: DiagnosticPhoto,
  file: File,
  onProgress: (progress: DiagnosticUploadProgress) => void,
  options: DiagnosticUploadOptions = {}
): Promise<Pick<DiagnosticPhoto, "downloadUrl" | "storagePath">> {
  validateDiagnosticImage(file);
  const firebase = createFirebaseServices();
  if (!firebase) throw new Error("Firebase Storage n'est pas configure.");

  const storageBucket = firebase.storage.app.options.storageBucket || "unknown";
  options.onEvent?.("storage_upload_started", {
    diagnosticId: photo.diagnosticId,
    photoId: photo.id,
    storagePath: photo.storagePath,
    storageBucket
  });
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
    let settled = false;
    let firstProgressSeen = false;
    let firebaseError: unknown;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      task.cancel();
      const timeoutError = Object.assign(
        new Error(`Le televersement de l'image a depasse ${Math.round((options.timeoutMs || diagnosticUploadTimeoutMs) / 1000)} secondes. Verifiez la connexion Internet puis reessayez.`),
        { code: "storage/timeout" }
      );
      if (firebaseError) {
        reject(firebaseError);
        return;
      }
      reject(timeoutError);
    }, options.timeoutMs || diagnosticUploadTimeoutMs);

    task.on(
      "state_changed",
      (snapshot) => {
        if (!firstProgressSeen) {
          firstProgressSeen = true;
          options.onEvent?.("storage_upload_first_progress", {
            diagnosticId: photo.diagnosticId,
            photoId: photo.id,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes
          });
        }
        onProgress({
          photoId: photo.id,
          progress: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        });
      },
      (error) => {
        settled = true;
        firebaseError = error;
        window.clearTimeout(timeout);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          settled = true;
          window.clearTimeout(timeout);
          options.onEvent?.("storage_upload_completed", {
            diagnosticId: photo.diagnosticId,
            photoId: photo.id,
            storagePath: photo.storagePath
          });
          resolve({
            storagePath: photo.storagePath,
            downloadUrl
          });
        } catch (error) {
          settled = true;
          firebaseError = error;
          window.clearTimeout(timeout);
          reject(error);
        }
      }
    );
  });
}

async function createBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function normalizePreparedFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") + ".jpg";
}
