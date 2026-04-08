const AUTH_BASE = '/api/auth';

const parseError = async (response) => {
    const payload = await response.json().catch(() => ({}));
    return payload.error || 'Falha na autenticacao';
};

export const login = async (username, password) => {
    const response = await fetch(`${AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        throw new Error(await parseError(response));
    }

    const payload = await response.json();
    return payload.user;
};

export const getSession = async () => {
    const response = await fetch(`${AUTH_BASE}/session`, {
        credentials: 'include',
    });

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
