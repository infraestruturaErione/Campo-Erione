import { Capacitor } from '@capacitor/core';

const normalizeBase = (value) => String(value || '').trim().replace(/\/$/, '');

const envApiBase = normalizeBase(import.meta.env.VITE_API_BASE_URL);

const isNativePlatform = () => {
    return Boolean(Capacitor?.isNativePlatform?.());
};

const isAndroidNative = () => {
    if (!isNativePlatform()) return false;
    return Capacitor?.getPlatform?.() === 'android';
};

const isCapacitorScheme = () => {
    if (typeof window === 'undefined') return false;
    const protocol = window.location?.protocol || '';
    return protocol === 'capacitor:' || protocol === 'ionic:';
};

// For Android emulators, host machine localhost is mapped to 10.0.2.2.
const defaultNativeApiBase = (isAndroidNative() || isCapacitorScheme()) ? 'http://10.0.2.2:3001' : '';

export const API_BASE = envApiBase || defaultNativeApiBase;
const SESSION_STORAGE_KEY = 'appcampo_session_id';
const SESSION_HEADER = 'X-Session-Id';
export const isNativeApiRuntime = isNativePlatform();

export const withApiBase = (path) => {
    if (!path.startsWith('/')) {
        throw new Error(`withApiBase expected absolute path, received: ${path}`);
    }
    return API_BASE ? `${API_BASE}${path}` : path;
};

export const getStoredSessionId = () => {
    if (typeof localStorage === 'undefined') return '';
    return String(localStorage.getItem(SESSION_STORAGE_KEY) || '').trim();
};

export const saveSessionId = (sessionId) => {
    if (typeof localStorage === 'undefined') return;
    if (!sessionId) return;
    localStorage.setItem(SESSION_STORAGE_KEY, String(sessionId));
};

export const clearSessionId = () => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SESSION_STORAGE_KEY);
};

export const buildAuthHeaders = (headers = {}) => {
    const sessionId = getStoredSessionId();
    if (!sessionId) return headers;
    return {
        ...headers,
        [SESSION_HEADER]: sessionId,
    };
};

export const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
};
