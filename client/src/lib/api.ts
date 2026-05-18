/**
 * PulseGrid AI — Centralized API Client
 * Wires all frontend calls to the Node.js backend
 */

import axios, { type AxiosInstance, type AxiosResponse } from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// ── Axios instance ────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ── Inject access token into every request ────────────────────────

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auto-refresh on 401 ───────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });
        setTokens(data.data.accessToken, data.data.refreshToken);
        failedQueue.forEach((p) => p.resolve(data.data.accessToken));
        failedQueue = [];
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (err) {
        failedQueue.forEach((p) => p.reject(err));
        failedQueue = [];
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Token helpers (localStorage — SSR-safe) ──────────────────────

const isBrowser = typeof window !== "undefined";

export function getAccessToken() {
  if (!isBrowser) return null;
  return localStorage.getItem("pg_access_token");
}
export function getRefreshToken() {
  if (!isBrowser) return null;
  return localStorage.getItem("pg_refresh_token");
}
export function setTokens(access: string, refresh: string) {
  if (!isBrowser) return;
  localStorage.setItem("pg_access_token", access);
  localStorage.setItem("pg_refresh_token", refresh);
}
export function clearTokens() {
  if (!isBrowser) return;
  localStorage.removeItem("pg_access_token");
  localStorage.removeItem("pg_refresh_token");
  localStorage.removeItem("pg_user");
}

// ── Response unwrapper ────────────────────────────────────────────

function unwrap<T>(res: AxiosResponse<{ success: boolean; data: T }>): T {
  return res.data.data;
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    return res.data;
  },
  register: async (body: {
    email: string; password: string; firstName: string;
    lastName: string; role: string; department?: string;
  }) => {
    const res = await api.post("/auth/register", body);
    return res.data;
  },
  logout: async () => {
    await api.post("/auth/logout");
    clearTokens();
  },
  refresh: async (refreshToken: string) => {
    const res = await api.post("/auth/refresh", { refreshToken });
    return res.data;
  },
  me: async () => {
    const res = await api.get("/auth/me");
    return unwrap(res);
  },
};

// ════════════════════════════════════════════════════════════════
// EHR
// ════════════════════════════════════════════════════════════════

export const ehrApi = {
  listPatients: async (params?: { page?: number; limit?: number; search?: string; riskLevel?: string }) => {
    const res = await api.get("/ehr/patients", { params });
    return res.data;
  },
  getPatient: async (id: string) => {
    const res = await api.get(`/ehr/patients/${id}`);
    return unwrap(res);
  },
  createPatient: async (body: object) => {
    const res = await api.post("/ehr/patients", body);
    return res.data;
  },
  updateEHR: async (id: string, body: object) => {
    const res = await api.patch(`/ehr/patients/${id}`, body);
    return res.data;
  },
  getTimeline: async (id: string) => {
    const res = await api.get(`/ehr/patients/${id}/timeline`);
    return unwrap(res);
  },
  getVersionHistory: async (id: string) => {
    const res = await api.get(`/ehr/patients/${id}/versions`);
    return unwrap(res);
  },
  rollback: async (id: string, body: { targetVersion: number; reason: string }) => {
    const res = await api.post(`/ehr/patients/${id}/rollback`, body);
    return res.data;
  },
};

// ════════════════════════════════════════════════════════════════
// ICU
// ════════════════════════════════════════════════════════════════

export const icuApi = {
  getOccupancy: async () => {
    const res = await api.get("/icu/occupancy");
    return unwrap(res);
  },
  getEmergencyQueue: async () => {
    const res = await api.get("/icu/emergency-queue");
    return unwrap(res);
  },
  allocate: async (body: { patientId: string; resourceType: "ICU_BED" | "VENTILATOR"; reason?: string }) => {
    const res = await api.post("/icu/allocate", body);
    return res.data;
  },
  release: async (allocationId: string) => {
    const res = await api.patch(`/icu/release/${allocationId}`);
    return res.data;
  },
  reassign: async (allocationId: string, body: { newPatientId: string; reason: string }) => {
    const res = await api.patch(`/icu/reassign/${allocationId}`, body);
    return res.data;
  },
  triggerPrediction: async (patientId: string) => {
    const res = await api.post(`/icu/predict/${patientId}`);
    return res.data;
  },
};

// ════════════════════════════════════════════════════════════════
// AI
// ════════════════════════════════════════════════════════════════

export const aiApi = {
  predict: async (features: object) => {
    const res = await api.post("/ai/predict", features);
    return unwrap(res);
  },
  health: async () => {
    const res = await api.get("/ai/health");
    return unwrap(res);
  },
};

// ════════════════════════════════════════════════════════════════
// AUDIT
// ════════════════════════════════════════════════════════════════

export const auditApi = {
  getLogs: async (params?: {
    entity?: string; entityId?: string; userId?: string; action?: string;
    startDate?: string; endDate?: string; page?: number; limit?: number;
  }) => {
    const res = await api.get("/audit/logs", { params });
    return res.data;
  },
  getEntityTimeline: async (entity: string, entityId: string) => {
    const res = await api.get(`/audit/entity/${entity}/${entityId}`);
    return unwrap(res);
  },
};

// ════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════

export const notificationsApi = {
  list: async (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => {
    const res = await api.get("/notifications", { params });
    return res.data;
  },
  markRead: async (ids: string[]) => {
    await api.patch("/notifications/read", { ids });
  },
};

// ════════════════════════════════════════════════════════════════
// SIMULATION
// ════════════════════════════════════════════════════════════════

export const simulationApi = {
  massCasualty: async (body: { patientCount?: number; scenario?: "critical" | "mixed" | "moderate" }) => {
    const res = await api.post("/simulation/mass-casualty", body);
    return res.data;
  },
  icuOverload: async () => {
    const res = await api.post("/simulation/icu-overload");
    return res.data;
  },
  alertStorm: async (count?: number) => {
    const res = await api.post("/simulation/alert-storm", { count });
    return res.data;
  },
};
