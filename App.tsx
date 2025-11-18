import React, { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Accelerometer, Pedometer } from "expo-sensors";

type ConnectionState = "connecting" | "connected" | "disconnected";

type SessionPayload = {
  sessionId: string;
  steps: number;
  durationSeconds: number;
  avgIntensity: number | null;
  timestamp: number;
  finished?: boolean;
};

const WS_URL = "ws://192.168.1.6:4000";

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [steps, setSteps] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [avgIntensity, setAvgIntensity] = useState<number | null>(null);
  const [pedometerAvailable, setPedometerAvailable] = useState<boolean | null>(
    null
  );
  const [statusMessage, setStatusMessage] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedoSub = useRef<any>(null);
  const accelSub = useRef<any>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const intensitySumRef = useRef(0);
  const intensitySamplesRef = useRef(0);
  const stepsRef = useRef(0);
  const durationRef = useRef(0);
  const avgIntensityRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const connectionColor = useMemo(() => {
    if (connection === "connected") return "#22c55e";
    if (connection === "connecting") return "#fbbf24";
    return "#ef4444";
  }, [connection]);

  useEffect(() => {
    Pedometer.isAvailableAsync()
      .then(setPedometerAvailable)
      .catch(() => setPedometerAvailable(false));
    connectSocket();
    return () => {
      cleanupSocket();
      cleanupSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectSocket = () => {
    cleanupSocket();
    setConnection("connecting");
    try {
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;
      socket.onopen = () => {
        setConnection("connected");
        setStatusMessage("WebSocket connected");
      };
      socket.onclose = () => {
        setConnection("disconnected");
        setStatusMessage("Socket closed, reconnecting...");
        scheduleReconnect();
      };
      socket.onerror = () => {
        setConnection("disconnected");
        setStatusMessage("Socket error, reconnecting...");
        scheduleReconnect();
      };
    } catch (err) {
      setConnection("disconnected");
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimer.current) return;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connectSocket();
    }, 1500);
  };

  const cleanupSocket = () => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onopen = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  };

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
    intensitySumRef.current = 0;
    intensitySamplesRef.current = 0;
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0");
    const mins = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const startSession = async () => {
    if (isRunning) return;

    const perm = await Pedometer.requestPermissionsAsync().catch(() => null);
    if (!perm || perm.status !== "granted") {
      setStatusMessage("Permission for activity recognition not granted.");
      return;
    }

    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      setStatusMessage("Pedometer not available (use physical device).");
      return;
    }

    const newId = `${Date.now()}`;
    setSessionId(newId);
    setSteps(0);
    setDurationSeconds(0);
    setAvgIntensity(null);
    stepsRef.current = 0;
    durationRef.current = 0;
    avgIntensityRef.current = null;
    sessionIdRef.current = newId;
    setIsRunning(true);
    setStatusMessage("Session started");
    sessionStartRef.current = Date.now();

    pedoSub.current = Pedometer.watchStepCount(({ steps: newSteps }) => {
      stepsRef.current = newSteps;
      setSteps(newSteps);
    });

    Accelerometer.setUpdateInterval(400);
    accelSub.current = Accelerometer.addListener((data) => {
      const magnitude = Math.sqrt(
        data.x * data.x + data.y * data.y + data.z * data.z
      );
      intensitySumRef.current += magnitude;
      intensitySamplesRef.current += 1;
      const avg =
        intensitySamplesRef.current > 0
          ? parseFloat(
              (intensitySumRef.current / intensitySamplesRef.current).toFixed(2)
            )
          : null;
      avgIntensityRef.current = avg;
      setAvgIntensity(avg);
    });

    tickTimer.current = setInterval(() => {
      if (sessionStartRef.current) {
        const diff = (Date.now() - sessionStartRef.current) / 1000;
        const val = Math.floor(diff);
        durationRef.current = val;
        setDurationSeconds(val);
      }
    }, 500);

    sendTimer.current = setInterval(() => {
      sendUpdate(false);
    }, 900);
  };

  const stopSession = () => {
    if (!isRunning) return;
    sendUpdate(true);
    cleanupSession();
    setIsRunning(false);
    setSessionId(null);
    sessionIdRef.current = null;
    sessionStartRef.current = null;
    setStatusMessage("Session stopped");
  };

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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const sessionStatus = isRunning ? "Đang đi bộ" : "Đã dừng";

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Wearable Walk Tracker</Text>
        <Text style={[styles.connection, { color: connectionColor }]}>
          {connection === "connected"
            ? "Connected"
            : connection === "connecting"
            ? "Connecting..."
            : "Disconnected"}
        </Text>
        <Text style={styles.ipHint}>WS_URL: {WS_URL}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Session</Text>
          <Text style={styles.value}>
            {sessionId ? sessionId : "Chưa bắt đầu"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Steps</Text>
          <Text style={styles.valueLarge}>{steps}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Duration</Text>
          <Text style={styles.valueLarge}>
            {formatDuration(durationSeconds)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Avg Intensity</Text>
          <Text style={styles.valueLarge}>
            {avgIntensity !== null ? avgIntensity.toFixed(2) : "--"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Trạng thái</Text>
          <Text style={styles.value}>{sessionStatus}</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.button,
            isRunning ? styles.buttonDisabled : styles.buttonPrimary,
          ]}
          onPress={startSession}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>Start Session</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            !isRunning ? styles.buttonDisabled : styles.buttonDanger,
          ]}
          onPress={stopSession}
          disabled={!isRunning}
        >
          <Text style={styles.buttonText}>Stop Session</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logCard}>
        <Text style={styles.label}>Log</Text>
        <ScrollView style={styles.logBox}>
          <Text style={styles.logText}>
            {statusMessage || "Ready to start walking session."}
          </Text>
          <Text style={styles.logText}>
            Pedometer:{" "}
            {pedometerAvailable === null
              ? "Checking..."
              : pedometerAvailable
              ? "Available"
              : "Not available"}
          </Text>
          <Text style={styles.logText}>
            Last update: {new Date().toLocaleTimeString()}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1224",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#e2e8f0",
    marginBottom: 4,
  },
  connection: {
    fontSize: 14,
    fontWeight: "700",
  },
  ipHint: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  label: {
    color: "#94a3b8",
    fontSize: 14,
  },
  value: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },
  valueLarge: {
    color: "#e2e8f0",
    fontSize: 24,
    fontWeight: "800",
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  buttonPrimary: {
    backgroundColor: "#22c55e",
  },
  buttonDanger: {
    backgroundColor: "#ef4444",
  },
  buttonDisabled: {
    backgroundColor: "#334155",
  },
  buttonText: {
    color: "#0b1224",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  logCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    padding: 14,
  },
  logBox: {
    marginTop: 8,
  },
  logText: {
    color: "#cbd5e1",
    marginBottom: 6,
  },
});
