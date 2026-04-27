import { CapacitorHttp } from '@capacitor/core';
import { buildAuthHeaders, clearSessionId, fetchWithTimeout, isNativeApiRuntime, saveSessionId, withApiBase } from './apiConfig';

const AUTH_BASE = withApiBase('/api/auth');

const parseError = async (response) => {
    const payload = await response.json().catch(() => ({}));
    return payload.error || 'Falha na autenticacao';
};

const parseNativeError = (response) => {
    const payload = response?.data;
    if (payload && typeof payload === 'object' && payload.error) {
        return payload.error;
    }
    return 'Falha na autenticacao';
};

export const login = async (username, password) => {
    if (isNativeApiRuntime) {
        try {
            const response = await CapacitorHttp.post({
                url: `${AUTH_BASE}/login`,
                headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
                data: { username, password },
                connectTimeout: 12000,
                readTimeout: 12000,
            });

            if (response.status < 200 || response.status >= 300) {
                throw new Error(parseNativeError(response));
            }

            saveSessionId(response.data?.sessionId);
            return response.data?.user ?? null;
        } catch (error) {
            if (error instanceof Error && error.message && error.message !== 'Erro desconhecido') {
                throw error;
            }
            throw new Error('Nao foi possivel conectar com a API de autenticacao.');
        }
    }

    let response;
    try {
        response = await fetchWithTimeout(`${AUTH_BASE}/login`, {
            method: 'POST',
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        }, 12000);
    } catch {
        throw new Error('Nao foi possivel conectar com a API de autenticacao.');
    }

    if (!response.ok) {
        throw new Error(await parseError(response));
    }

    const payload = await response.json();
    saveSessionId(payload.sessionId);
    return payload.user;
};

export const getSession = async () => {
    if (isNativeApiRuntime) {
        try {
            const response = await CapacitorHttp.get({
                url: `${AUTH_BASE}/session`,
                headers: buildAuthHeaders(),
                connectTimeout: 7000,
                readTimeout: 7000,
            });

            if (response.status < 200 || response.status >= 300) {
                if (response.status === 401 || response.status === 403) {
                    clearSessionId();
                }
                return null;
            }

            return response.data?.user ?? null;
        } catch {
            return null;
        }
    }

    let response;
    try {
        response = await fetchWithTimeout(`${AUTH_BASE}/session`, {
            headers: buildAuthHeaders(),
            credentials: 'include',
        }, 7000);
    } catch {
        return null;
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            clearSessionId();
        }
        return null;
    }

    const payload = await response.json();
    return payload.user;
};

export const logout = async () => {
    if (isNativeApiRuntime) {
        await CapacitorHttp.post({
            url: `${AUTH_BASE}/logout`,
            headers: buildAuthHeaders(),
            connectTimeout: 7000,
            readTimeout: 7000,
        }).catch(() => null);
        clearSessionId();
        return;
    }

    await fetchWithTimeout(`${AUTH_BASE}/logout`, {
        method: 'POST',
        headers: buildAuthHeaders(),
        credentials: 'include',
    }, 7000).catch(() => null);
    clearSessionId();
};
