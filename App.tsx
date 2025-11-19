import React, { useMemo } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useWearableSession } from "./src/hooks/useWearableSession";

export default function App() {
  const { state, startSession, stopSession } = useWearableSession();

  const sensorStatusColor = useMemo(() => {
    if (state.pedometerAvailable === true) return "#22c55e";
    if (state.pedometerAvailable === false) return "#f97316";
    return "#fbbf24";
  }, [state.pedometerAvailable]);

  const sensorStatusText = useMemo(() => {
    if (state.pedometerAvailable === true) return "Pedometer OK";
    if (state.pedometerAvailable === false)
      return "Pedometer not available (accelerometer only)";
    return "Checking sensors...";
  }, [state.pedometerAvailable]);

  const sessionStatus = state.isRunning ? "Walking" : "Stopped";

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Wearable Walk Tracker</Text>
        <Text style={[styles.connection, { color: sensorStatusColor }]}>
          {sensorStatusText}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Session</Text>
          <Text style={styles.value}>
            {state.sessionId ? state.sessionId : "Not started"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Steps</Text>
          <Text style={styles.valueLarge}>{state.steps}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Duration</Text>
          <Text style={styles.valueLarge}>
            {formatDuration(state.durationSeconds)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Avg Intensity</Text>
          <Text style={styles.valueLarge}>
            {state.avgIntensity !== null ? state.avgIntensity.toFixed(2) : "--"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{sessionStatus}</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.button,
            state.isRunning ? styles.buttonDisabled : styles.buttonPrimary,
          ]}
          onPress={startSession}
          disabled={state.isRunning}
        >
          <Text style={styles.buttonText}>Start Session</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            !state.isRunning ? styles.buttonDisabled : styles.buttonDanger,
          ]}
          onPress={stopSession}
          disabled={!state.isRunning}
        >
          <Text style={styles.buttonText}>Stop Session</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logCard}>
        <Text style={styles.label}>Log</Text>
        <ScrollView style={styles.logBox}>
          <Text style={styles.logText}>
            {state.statusMessage || "Ready to start walking session."}
          </Text>
          <Text style={styles.logText}>
            Pedometer:{" "}
            {state.pedometerAvailable === null
              ? "Checking..."
              : state.pedometerAvailable
              ? "Available"
              : "Not available (using accelerometer only)"}
          </Text>
          <Text style={styles.logText}>
            Last update: {new Date().toLocaleTimeString()}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

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
