import { useEffect, useRef, useState } from "react";
import { Accelerometer, Pedometer } from "expo-sensors";
import { SessionPayload, SessionState } from "../types";

type Options = {
  sendIntervalMs?: number;
  pollIntervalMs?: number;
  accelIntervalMs?: number;
};

export function useWearableSession(
  onPayload?: (payload: SessionPayload) => void,
  options: Options = {}
) {
  const sendIntervalMs = options.sendIntervalMs ?? 900;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const accelIntervalMs = options.accelIntervalMs ?? 200;

  const [state, setState] = useState<SessionState>({
    sessionId: null,
    steps: 0,
    durationSeconds: 0,
    avgIntensity: null,
    isRunning: false,
    pedometerAvailable: null,
    statusMessage: "",
  });

  const pedoSub = useRef<any>(null);
  const accelSub = useRef<any>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pedoPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const pedoBaselineRef = useRef(0);
  const intensitySumRef = useRef(0);
  const intensitySamplesRef = useRef(0);
  const stepsRef = useRef(0);
  const durationRef = useRef(0);
  const avgIntensityRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const cleanupSession = () => {
    if (pedoSub.current) {
      pedoSub.current.remove();
      pedoSub.current = null;
    }
    if (accelSub.current) {
      accelSub.current.remove();
      accelSub.current = null;
    }
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
    if (sendTimer.current) {
      clearInterval(sendTimer.current);
      sendTimer.current = null;
    }
    if (pedoPollTimer.current) {
      clearInterval(pedoPollTimer.current);
      pedoPollTimer.current = null;
    }
    intensitySumRef.current = 0;
    intensitySamplesRef.current = 0;
  };

  useEffect(() => {
    return () => cleanupSession();
  }, []);

  const sendUpdate = (finished: boolean) => {
    const activeSession = sessionIdRef.current;
    if (!activeSession) return;
    const payload: SessionPayload = {
      sessionId: activeSession,
      steps: stepsRef.current,
      durationSeconds: durationRef.current,
      avgIntensity: avgIntensityRef.current,
      timestamp: Date.now(),
      finished,
    };
    onPayload?.(payload);
  };

  const startSession = async () => {
    if (state.isRunning) return;

    const perm = await Pedometer.requestPermissionsAsync().catch(() => null);
    if (!perm || perm.status !== "granted") {
      setState((s) => ({
        ...s,
        statusMessage: "Permission for activity recognition not granted.",
      }));
      return;
    }

    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      setState((s) => ({
        ...s,
        pedometerAvailable: false,
        statusMessage: "Pedometer not available (use physical device).",
      }));
      return;
    }

    const newId = `${Date.now()}`;
    pedoBaselineRef.current = 0;
    stepsRef.current = 0;
    durationRef.current = 0;
    avgIntensityRef.current = null;
    sessionIdRef.current = newId;
    sessionStartRef.current = Date.now();

    setState((s) => ({
      ...s,
      sessionId: newId,
      steps: 0,
      durationSeconds: 0,
      avgIntensity: null,
      pedometerAvailable: true,
      isRunning: true,
      statusMessage: "Session started",
    }));

    try {
      const totalNow = await Pedometer.getStepCountAsync(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date()
      );
      pedoBaselineRef.current = totalNow.steps;
    } catch {
      pedoBaselineRef.current = 0;
    }

    pedoSub.current = Pedometer.watchStepCount(({ steps: delta }) => {
      stepsRef.current = delta;
      setState((s) => ({ ...s, steps: delta }));
    });

    pedoPollTimer.current = setInterval(async () => {
      try {
        const total = await Pedometer.getStepCountAsync(
          new Date(Date.now() - 24 * 60 * 60 * 1000),
          new Date()
        );
        const sessionSteps = Math.max(0, total.steps - pedoBaselineRef.current);
        stepsRef.current = sessionSteps;
        setState((s) => ({ ...s, steps: sessionSteps }));
      } catch {
      }
    }, pollIntervalMs);

    Accelerometer.setUpdateInterval(accelIntervalMs);
    accelSub.current = Accelerometer.addListener((data) => {
      const magnitudeRaw = Math.sqrt(
        data.x * data.x + data.y * data.y + data.z * data.z
      );
      
      const magnitude = Math.abs(magnitudeRaw - 9.81);
      intensitySumRef.current += magnitude;
      intensitySamplesRef.current += 1;
      const avg =
        intensitySamplesRef.current > 0
          ? parseFloat(
              (
                intensitySumRef.current / intensitySamplesRef.current
              ).toFixed(2)
            )
          : null;
      avgIntensityRef.current = avg;
      setState((s) => ({ ...s, avgIntensity: avg }));
    });

    tickTimer.current = setInterval(() => {
      if (sessionStartRef.current) {
        const diff = (Date.now() - sessionStartRef.current) / 1000;
        const val = Math.floor(diff);
        durationRef.current = val;
        setState((s) => ({ ...s, durationSeconds: val }));
      }
    }, 500);

    sendTimer.current = setInterval(() => {
      sendUpdate(false);
    }, sendIntervalMs);
  };

  const stopSession = () => {
    if (!state.isRunning) return;
    sendUpdate(true);
    cleanupSession();
    sessionIdRef.current = null;
    sessionStartRef.current = null;
    setState((s) => ({
      ...s,
      isRunning: false,
      sessionId: null,
      statusMessage: "Session stopped",
    }));
  };

  return {
    state,
    startSession,
    stopSession,
  };
}
