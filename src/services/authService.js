const AUTH_TOKEN_KEY = 'appcampo_auth_token';

export const login = async (username, password) => {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Falha no login');
    }

    const payload = await response.json();
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    return payload.user;
};

export const getSession = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
        return null;
    }

    const response = await fetch('/api/auth/session', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        return null;
    }

    const payload = await response.json();
    return payload.user;
};

export const logout = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);

    if (!token) {
        return;
    }

    await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).catch(() => null);
};

