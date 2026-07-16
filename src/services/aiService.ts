export interface ReportTextRequest {
  rawText: string;
  language: "fr";
}

export interface VoiceTranscriptionRequest {
  mediaId: string;
}

export interface AiService {
  improveReportText(request: ReportTextRequest): Promise<string>;
  transcribeVoiceNote(request: VoiceTranscriptionRequest): Promise<string>;
}

export class DisabledAiService implements AiService {
  async improveReportText(request: ReportTextRequest): Promise<string> {
    return `${request.rawText}\n\nIA prevue mais non activee dans cette version.`;
  }

  async transcribeVoiceNote(): Promise<string> {
    return "Transcription vocale prevue mais non activee.";
  }
}

export const aiService: AiService = new DisabledAiService();
