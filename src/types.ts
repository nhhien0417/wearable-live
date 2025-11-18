export type ConnectionState = "connecting" | "connected" | "disconnected";

export type SessionPayload = {
  sessionId: string;
  steps: number;
  durationSeconds: number;
  avgIntensity: number | null;
  timestamp: number;
  finished?: boolean;
};

export type SessionState = {
  sessionId: string | null;
  steps: number;
  durationSeconds: number;
  avgIntensity: number | null;
  isRunning: boolean;
  pedometerAvailable: boolean | null;
  statusMessage: string;
};
