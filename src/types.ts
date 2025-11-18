export type SessionState = {
  sessionId: string | null;
  steps: number;
  durationSeconds: number;
  avgIntensity: number | null;
  isRunning: boolean;
  pedometerAvailable: boolean | null;
  statusMessage: string;
};
