import { useEffect, useRef, useState } from "react";
import { Accelerometer, Pedometer } from "expo-sensors";
import { SessionState } from "../types";

const STEP_THRESHOLD = 1.25;
const HYSTERESIS_FACTOR = 0.5;
const MIN_STEP_INTERVAL_MS = 500;

export function useWearableSession() {
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    steps: 0,
    durationSeconds: 0,
    avgIntensity: null,
    isRunning: false,
    pedometerAvailable: null,
    statusMessage: "",
  });

  const accelSub = useRef<ReturnType<typeof Accelerometer.addListener> | null>(
    null
  );
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionStartRef = useRef<number | null>(null);
  const stepsRef = useRef(0);
  const durationRef = useRef(0);
  const intensitySumRef = useRef(0);
  const intensitySamplesRef = useRef(0);
  const avgIntensityRef = useRef<number | null>(null);

  const lastStepTimeRef = useRef(0);
  const overThresholdRef = useRef(false);

  const cleanupSession = () => {
    if (accelSub.current) {
      accelSub.current.remove();
      accelSub.current = null;
    }
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }

    sessionStartRef.current = null;
    stepsRef.current = 0;
    durationRef.current = 0;
    intensitySumRef.current = 0;
    intensitySamplesRef.current = 0;
    avgIntensityRef.current = null;
    lastStepTimeRef.current = 0;
    overThresholdRef.current = false;
  };

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, []);

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
    setState((s) => ({
      ...s,
      pedometerAvailable: available,
    }));

    if (!available) {
      setState((s) => ({
        ...s,
        statusMessage: "Pedometer not available (use physical device).",
      }));
    }

    const newId = `${Date.now()}`;

    sessionStartRef.current = Date.now();
    stepsRef.current = 0;
    durationRef.current = 0;
    intensitySumRef.current = 0;
    intensitySamplesRef.current = 0;
    avgIntensityRef.current = null;
    lastStepTimeRef.current = 0;
    overThresholdRef.current = false;

    setState((s) => ({
      ...s,
      sessionId: newId,
      steps: 0,
      durationSeconds: 0,
      avgIntensity: null,
      isRunning: true,
      statusMessage: "Session started",
    }));

    Accelerometer.setUpdateInterval(50);
    accelSub.current = Accelerometer.addListener((data) => {
      const magRaw = Math.sqrt(
        data.x * data.x + data.y * data.y + data.z * data.z
      );
      const mag = Math.abs(magRaw - 9.81);

      intensitySumRef.current += mag;
      intensitySamplesRef.current += 1;
      const avg =
        intensitySamplesRef.current > 0
          ? parseFloat(
              (intensitySumRef.current / intensitySamplesRef.current).toFixed(2)
            )
          : null;
      avgIntensityRef.current = avg;

      setState((s) => ({
        ...s,
        avgIntensity: avg,
      }));

      const now = Date.now();
      if (!overThresholdRef.current && mag > STEP_THRESHOLD) {
        if (now - lastStepTimeRef.current > MIN_STEP_INTERVAL_MS) {
          lastStepTimeRef.current = now;
          overThresholdRef.current = true;

          stepsRef.current += 1;
          setState((s) => ({
            ...s,
            steps: stepsRef.current,
          }));
        }
      }

      if (
        overThresholdRef.current &&
        mag < STEP_THRESHOLD * HYSTERESIS_FACTOR
      ) {
        overThresholdRef.current = false;
      }
    });

    tickTimer.current = setInterval(() => {
      if (!sessionStartRef.current) return;
      const diff = (Date.now() - sessionStartRef.current) / 1000;
      const val = Math.floor(diff);
      if (val !== durationRef.current) {
        durationRef.current = val;
        setState((s) => ({
          ...s,
          durationSeconds: val,
        }));
      }
    }, 200);
  };

  const stopSession = () => {
    if (!state.isRunning) return;
    cleanupSession();
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
