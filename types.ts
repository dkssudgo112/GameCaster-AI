export enum CasterStyle {
  PRO = 'PRO',
  HYPE = 'HYPE',
  FRIEND = 'FRIEND',
  ANALYTIC = 'ANALYTIC'
}

export enum GameEventType {
  DANGER = 'DANGER',
  TURN = 'TURN',
  CLUTCH = 'CLUTCH',
  OBJ = 'OBJ',
  STREAK = 'STREAK',
  USER_PICK = 'USER_PICK',
  NORMAL = 'NORMAL'
}

export interface GameEvent {
  id: string;
  timestamp: number; // seconds relative to start
  type: GameEventType;
  description: string;
}

export interface AppConfig {
  style: CasterStyle;
  hypeLevel: number; // 0 to 100
  inputType: 'SAMPLE' | 'SCREEN' | 'LOCAL';
  mediaSource?: string | MediaStream; // URL (Sample/Local) or MediaStream (Screen)
  showSubtitles: boolean;
}

export interface StreamSessionStatus {
  isConnected: boolean;
  isStreaming: boolean;
  error?: string;
}

export interface AnalysisResult {
  highlights: {
    title: string;
    timestamp: string;
    description: string;
  }[];
  playStyle: {
    archetype: string;
    strengths: string[];
    improvement: string;
  };
}