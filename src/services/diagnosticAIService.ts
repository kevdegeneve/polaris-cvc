import type { AIAnalysisRequest, AIAnalysisResponse } from "../domain/types";
import { getFunctions, httpsCallable } from "firebase/functions";
import { createFirebaseServices } from "./firebaseClient";

export const diagnosticFunctionTimeoutMs = 90_000;

export interface DiagnosticAIService {
  isAvailable(): boolean;
  analyzeInitialPhotos(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
  analyzeAdditionalPhoto(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
  continueDiagnosticConversation(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
  generateFinalDiagnostic(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
  findTechnicalSources(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
  summarizeTechnicalDocument(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
}

const notConnectedResponse: AIAnalysisResponse = {
  status: "not_connected",
  message: "L'analyse IA n'est pas encore connectee. Le parcours est pret, mais aucun diagnostic automatique n'est genere."
};

function isCallableConfigured(): boolean {
  return Boolean(createFirebaseServices());
}

export class NotConnectedDiagnosticAIService implements DiagnosticAIService {
  isAvailable(): boolean {
    return false;
  }

  async analyzeInitialPhotos(_request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return notConnectedResponse;
  }

  async analyzeAdditionalPhoto(_request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return notConnectedResponse;
  }

  async continueDiagnosticConversation(_request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return notConnectedResponse;
  }

  async generateFinalDiagnostic(_request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return notConnectedResponse;
  }

  async findTechnicalSources(_request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return notConnectedResponse;
  }

  async summarizeTechnicalDocument(_request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return notConnectedResponse;
  }
}

export class FirebaseDiagnosticAIService implements DiagnosticAIService {
  isAvailable(): boolean {
    return isCallableConfigured();
  }

  async analyzeInitialPhotos(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const firebase = createFirebaseServices();
    if (!firebase) return notConnectedResponse;
    const callable = httpsCallable<{ diagnosticId: string }, AIAnalysisResponse>(getFunctions(firebase.app, "europe-west1"), "analyzeDiagnostic");
    const result = await withTimeout(
      callable({ diagnosticId: request.diagnosticId }),
      diagnosticFunctionTimeoutMs,
      "L'analyse IA depasse 90 secondes. Polaris a arrete l'attente pour eviter un chargement infini."
    );
    return result.data;
  }

  async analyzeAdditionalPhoto(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return this.analyzeInitialPhotos(request);
  }

  async continueDiagnosticConversation(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return this.analyzeInitialPhotos(request);
  }

  async generateFinalDiagnostic(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return this.analyzeInitialPhotos(request);
  }

  async findTechnicalSources(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return this.analyzeInitialPhotos(request);
  }

  async summarizeTechnicalDocument(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return this.analyzeInitialPhotos(request);
  }
}

export const diagnosticAIService: DiagnosticAIService = new FirebaseDiagnosticAIService();

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
