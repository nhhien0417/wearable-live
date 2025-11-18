import { useEffect, useRef, useState, useCallback } from "react";
import { ConnectionState } from "../types";

type Options = {
  reconnectDelayMs?: number;
};

export function useWebSocket(url: string, options: Options = {}) {
  const reconnectDelay = options.reconnectDelayMs ?? 1500;
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupSocket = useCallback(() => {
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
  }, []);

  const connect = useCallback(() => {
    cleanupSocket();
    setConnection("connecting");
    try {
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnection("connected");
      };

      const scheduleReconnect = () => {
        if (reconnectTimer.current) return;
        reconnectTimer.current = setTimeout(() => {
          reconnectTimer.current = null;
          connect();
        }, reconnectDelay);
      };

      socket.onclose = () => {
        setConnection("disconnected");
        scheduleReconnect();
      };

      socket.onerror = () => {
        setConnection("disconnected");
        scheduleReconnect();
      };
    } catch {
      setConnection("disconnected");
    }
  }, [cleanupSocket, reconnectDelay, url]);

  useEffect(() => {
    connect();
    return () => cleanupSocket();
  }, [cleanupSocket, connect]);

  const sendJson = useCallback((payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  return { connection, sendJson, reconnect: connect };
}
