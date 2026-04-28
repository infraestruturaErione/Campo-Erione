import { buildAuthHeaders, fetchWithTimeout, withApiBase } from './apiConfig';

const ADMIN_BASE = withApiBase('/api/admin');

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

    const response = await fetchWithTimeout(`${ADMIN_BASE}/users?${query.toString()}`, {
        headers: buildAuthHeaders(),
        credentials: 'include',
    }, 10000);

    if (!response.ok) {
        throw new Error(await parseError(response));
    }

    const payload = await response.json();
    return payload.items || [];
};

export const fetchAdminOS = async ({ search = '', status = '' } = {}) => {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status) query.set('status', status);

    const response = await fetchWithTimeout(`${ADMIN_BASE}/os?${query.toString()}`, {
        headers: buildAuthHeaders(),
        credentials: 'include',
    }, 12000);

    if (!response.ok) {
        throw new Error(await parseError(response));
    }

    const payload = await response.json();
    const items = payload.items || [];
    return items.map((item) => {
        const source = item.payload || {};
        return {
            ...source,
            id: item.osId,
            osId: item.osId,
            status: item.status || source.status || '-',
            obraEquipamento: item.obraEquipamento || source.obraEquipamento || '-',
            responsavelContratada: item.responsavelContratada || source.responsavelContratada || '-',
            responsavelMotiva: source.responsavelMotiva || '-',
            horarioInicio: source.horarioInicio || '-',
            horarioFim: source.horarioFim || '-',
            local: source.local || '-',
            descricao: source.descricao || '-',
            ocorrencias: source.ocorrencias || '',
            createdAt: item.createdAt || source.createdAt || item.updatedAt,
            updatedAt: item.updatedAt || source.updatedAt || item.createdAt,
            ownerName: source.ownerName || item.submittedBy || '-',
            ownerUsername: source.ownerUsername || item.submittedBy || '-',
            statusSync: 'SINCRONIZADO',
            photoIds: Array.isArray(source.photoIds) ? source.photoIds : [],
            photosMeta: Array.isArray(source.photosMeta) ? source.photosMeta : [],
        };
    });
};

export const createAdminUser = async ({ name, username, password, role }) => {
    const response = await fetchWithTimeout(`${ADMIN_BASE}/users`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ name, username, password, role }),
    }, 12000);

    if (!response.ok) {
        throw new Error(await parseError(response));
    }
};

export const updateAdminUser = async (userId, payload) => {
    const response = await fetchWithTimeout(`${ADMIN_BASE}/users/${userId}`, {
        method: 'PATCH',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload),
    }, 12000);

    if (!response.ok) {
        throw new Error(await parseError(response));
    }
};

export const deleteAdminUser = async (userId) => {
    const response = await fetchWithTimeout(`${ADMIN_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(),
        credentials: 'include',
    }, 10000);

    if (!response.ok) {
        throw new Error(await parseError(response));
    }
};
