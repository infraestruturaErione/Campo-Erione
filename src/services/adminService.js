const ADMIN_BASE = '/api/admin';

const parseError = async (response) => {
    const payload = await response.json().catch(() => null);
    if (payload?.error) {
        return payload.error;
    }
    if (response.status === 401) {
        return 'Sessao expirada. Entre novamente.';
    }
    if (response.status === 403) {
        return 'Acesso restrito para administradores.';
    }
    if (response.status === 409) {
        return 'Usuario ja cadastrado.';
    }
    return `Falha na operacao administrativa (HTTP ${response.status})`;
};

export const fetchAdminUsers = async ({ search = '' } = {}) => {
    const query = new URLSearchParams();
    if (search) query.set('search', search);

    const response = await fetch(`${ADMIN_BASE}/users?${query.toString()}`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(await parseError(response));
    }

    const payload = await response.json();
    return payload.items || [];
};

export const createAdminUser = async ({ name, username, password, role }) => {
    const response = await fetch(`${ADMIN_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, username, password, role }),
    });

    if (!response.ok) {
        throw new Error(await parseError(response));
    }
};

export const updateAdminUser = async (userId, payload) => {
    const response = await fetch(`${ADMIN_BASE}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await parseError(response));
    }
};

export const deleteAdminUser = async (userId) => {
    const response = await fetch(`${ADMIN_BASE}/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(await parseError(response));
    }
};
