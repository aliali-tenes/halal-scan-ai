
export enum AnalysisStatus {
  HALAL = 'halal',
  HARAM = 'haram',
  DOUBTFUL = 'doubtful'
}

export type HalalTheme = 'classic' | 'teal' | 'gold' | 'blue';

export interface ENumberDetail {
  code: string;
  name: string;
  status: string;
  source: string;
  description: string;
}

export interface AnalysisResult {
  status: AnalysisStatus;
  ingredients: string[];
  haramIngredients: string[];
  doubtfulIngredients: string[];
  eNumberDetails?: ENumberDetail[];
  reason: string;
  alternatives?: string[];
  recommendation: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  imagePreview: string;
  result: AnalysisResult;
}

export interface GeminiPart {
  inlineData?: {
    mimeType: string;
    data: string;
  };
  text?: string;
}
