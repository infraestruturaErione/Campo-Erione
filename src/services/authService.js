const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const AUTH_BASE = API_BASE ? `${API_BASE}/api/auth` : '/api/auth';

const parseError = async (response) => {
    const payload = await response.json().catch(() => ({}));
    return payload.error || 'Falha na autenticacao';
};

export const login = async (username, password) => {
    let response;
    try {
        response = await fetch(`${AUTH_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password }),
        });
    } catch {
        throw new Error('Nao foi possivel conectar com a API de autenticacao.');
    }

    if (!response.ok) {
        throw new Error(await parseError(response));
    }

    const payload = await response.json();
    return payload.user;
};

export const getSession = async () => {
    let response;
    try {
        response = await fetch(`${AUTH_BASE}/session`, {
            credentials: 'include',
        });
    } catch {
        return null;
    }

    if (!response.ok) {
        return null;
    }

    const payload = await response.json();
    return payload.user;
};

export const logout = async () => {
    await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
    }).catch(() => null);
};
