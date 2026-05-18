/**
 * PulseGrid AI — Shared React Hooks (SSR-safe)
 */

import { useState, useEffect, useCallback } from "react";
import { auth, type AuthUser } from "./auth";
import { connectSocket, disconnectSocket, onEvent, EVENTS } from "./socket";

// ── Auth hook ─────────────────────────────────────────────────────

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() =>
    typeof window !== "undefined" ? auth.getUser() : null
  );

  useEffect(() => {
    // Sync with storage on mount (client only)
    setUser(auth.getUser());
    const unsub = auth.subscribe(setUser);
    return unsub;
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    login: auth.login.bind(auth),
    logout: auth.logout.bind(auth),
  };
}

// ── WebSocket hook ────────────────────────────────────────────────

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoggedIn || typeof window === "undefined") return;
    let cleanedUp = false;

    connectSocket().then((socket) => {
      if (!socket || cleanedUp) return;
      const onConnect = () => setConnected(true);
      const onDisconnect = () => setConnected(false);
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      if (socket.connected) setConnected(true);
    });

    return () => {
      cleanedUp = true;
      setConnected(false);
      disconnectSocket();
    };
  }, [isLoggedIn]);

  return { connected };
}

// ── Real-time emergency alerts ────────────────────────────────────

export function useEmergencyAlerts() {
  const [alerts, setAlerts] = useState<Array<{
    alertId: string; title: string; message: string;
    severity: string; patientId?: string; timestamp: string;
  }>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = onEvent(EVENTS.EMERGENCY_ALERT, (data: unknown) => {
      const alert = data as { alertId: string; title: string; message: string; severity: string; patientId?: string; timestamp: string };
      setAlerts((prev) => [alert, ...prev].slice(0, 20));
    });
    return unsub;
  }, []);

  const dismiss = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.alertId !== alertId));
  }, []);

  return { alerts, dismiss };
}

// ── Real-time notifications ───────────────────────────────────────

export function useNotifications() {
  const [notifications, setNotifications] = useState<Array<{
    id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string;
  }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = onEvent(EVENTS.NOTIFICATION, (data: unknown) => {
      const n = data as { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string };
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
    });
    return unsub;
  }, []);

  return { notifications, unreadCount };
}

// ── Real-time ICU occupancy ───────────────────────────────────────

export function useOccupancyUpdates(onUpdate: (data: unknown) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = onEvent(EVENTS.OCCUPANCY_UPDATE, onUpdate);
    return unsub;
  }, [onUpdate]);
}

// ── Simulation events ─────────────────────────────────────────────

export function useSimulationEvents() {
  const [events, setEvents] = useState<Array<{ type: string; timestamp: string; [key: string]: unknown }>>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unsub = onEvent(EVENTS.SIMULATION_EVENT, (data: unknown) => {
      const event = data as { type: string; timestamp: string };
      setEvents((prev) => [event, ...prev].slice(0, 100));
    });
    return unsub;
  }, []);

  return { events };
}
