/**
 * PulseGrid AI — Socket.IO Client (SSR-safe)
 * Only connects in browser context — no-ops on server.
 */

// Lazy import so socket.io-client is never evaluated in SSR
import type { Socket } from "socket.io-client";
import { getAccessToken } from "./api";

const SOCKET_URL = typeof window !== "undefined"
  ? (import.meta.env?.VITE_API_URL || "http://localhost:4000")
  : "http://localhost:4000";

// ── Socket Events (mirror server constants) ───────────────────────

export const EVENTS = {
  PATIENT_UPDATED: "patient:updated",
  ICU_ALLOCATED: "icu:allocated",
  ICU_RELEASED: "icu:released",
  ICU_REASSIGNED: "icu:reassigned",
  EMERGENCY_ALERT: "emergency:alert",
  AI_RISK_ESCALATION: "ai:risk_escalation",
  OCCUPANCY_UPDATE: "icu:occupancy_update",
  NOTIFICATION: "notification:new",
  SIMULATION_EVENT: "simulation:event",
  JOIN_ROOM: "room:join",
  LEAVE_ROOM: "room:leave",
  ACK_ALERT: "alert:acknowledge",
} as const;

// ── Singleton socket ──────────────────────────────────────────────

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(): Promise<Socket | null> {
  // Never run in SSR
  if (typeof window === "undefined") return null;
  if (socket?.connected) return socket;

  // Dynamic import so socket.io-client bundle is never loaded on server
  const { io } = await import("socket.io-client");
  const token = getAccessToken();

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("[WS] Connected:", socket?.id);
  });

  socket.on("connect_error", (err) => {
    console.warn("[WS] Connection error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[WS] Disconnected:", reason);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/**
 * Subscribe to a Socket.IO event. Returns an unsubscribe function.
 * Safe to call in SSR — returns no-op if no socket.
 */
export function onEvent<T = unknown>(
  event: string,
  handler: (data: T) => void
): () => void {
  const s = getSocket();
  if (!s) return () => {};
  s.on(event, handler);
  return () => s.off(event, handler);
}

export function emitEvent(event: string, data?: unknown) {
  const s = getSocket();
  if (s?.connected) {
    s.emit(event, data);
  }
}
