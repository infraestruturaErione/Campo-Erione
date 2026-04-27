import { getOSList, saveOS } from './storage';
import { logProgress } from './progressLog';
import { emitOSUpdated } from '../events/eventBus';
import { buildAuthHeaders, withApiBase } from './apiConfig';
import { getStoredPhotoBlob } from './photoBlob';

const SYNC_QUEUE_KEY = 'appcampo_sync_queue_v1';
const SYNC_STATE_KEY = 'appcampo_sync_state_v1';
const SYNC_ENDPOINT = import.meta.env.VITE_SYNC_ENDPOINT || withApiBase('/api/sync/os');
const MEDIA_UPLOAD_ENDPOINT = withApiBase('/api/media/upload');
let syncInFlight = false;

const loadQueue = () => {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
};

const saveQueue = (queue) => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    return queue;
};

const saveSyncState = (state) => {
    const current = getSyncState();
    const merged = { ...current, ...state };
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(merged));
    return merged;
};

export const getSyncState = () => {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    return raw
        ? JSON.parse(raw)
        : { pending: 0, lastSyncAt: null, lastResult: 'idle', message: '' };
};

export const getPendingSyncCount = () => loadQueue().length;

const updateOSSyncStatus = (osId, statusSync, patch = {}) => {
    const list = getOSList();
    const target = list.find((item) => item.id === osId);
    if (!target) return;

    saveOS({ ...target, ...patch, statusSync });
};

const upsertQueueOperation = (operation) => {
    const queue = loadQueue();
    const next = queue.filter((item) => item.osId !== operation.osId);
    next.push(operation);
    saveQueue(next);
    saveSyncState({ pending: next.length, lastResult: 'queued', message: 'Fila offline atualizada' });
    return next;
};

export const queueOSCreateOrUpdate = (os) => {
    upsertQueueOperation({
        id: crypto.randomUUID(),
        type: 'UPSERT',
        osId: os.id,
        payload: os,
        createdAt: new Date().toISOString(),
    });
    updateOSSyncStatus(os.id, 'PENDENTE_SYNC');
    emitOSUpdated();
};

export const queueOSDelete = (os) => {
    const queue = loadQueue();
    const withoutSame = queue.filter((item) => item.osId !== os.id);

    // If the OS never synced and only exists as UPSERT pending, deleting locally is enough.
    const hadPendingUpsert = queue.some((item) => item.osId === os.id && item.type === 'UPSERT');
    const next = hadPendingUpsert
        ? withoutSame
        : [
            ...withoutSame,
            {
                id: crypto.randomUUID(),
                type: 'DELETE',
                osId: os.id,
                payload: { id: os.id },
                createdAt: new Date().toISOString(),
            },
        ];

    saveQueue(next);
    saveSyncState({
        pending: next.length,
        lastResult: 'queued',
        message: hadPendingUpsert ? 'OS removida localmente antes da sincronizacao' : 'Exclusao pendente de sincronizacao',
    });
    emitOSUpdated();
};

const sendSyncOperation = async (operation) => {
    const response = await fetch(SYNC_ENDPOINT, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(operation),
    });

    if (!response.ok) {
        throw new Error(`Falha HTTP ${response.status}`);
    }
};

const uploadPhotoToBucket = async ({ osId, photoMeta, blob }) => {
    const formData = new FormData();
    const extension = blob.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${photoMeta.id || crypto.randomUUID()}.${extension}`;
    formData.append('file', blob, filename);
    formData.append('osId', osId);

    const response = await fetch(MEDIA_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: buildAuthHeaders(),
        credentials: 'include',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Falha no upload da imagem (HTTP ${response.status})`);
    }

    return response.json();
};

const ensureSyncedPhotoMeta = async (operation) => {
    if (operation?.type !== 'UPSERT') {
        return operation;
    }

    const payload = operation.payload || {};
    const sourceMeta = Array.isArray(payload.photosMeta) && payload.photosMeta.length > 0
        ? payload.photosMeta
        : (payload.photoIds || []).map((id) => ({ id, note: '' }));

    const syncedMeta = [];
    for (const photoMeta of sourceMeta) {
        if (photoMeta.objectKey && photoMeta.url) {
            syncedMeta.push(photoMeta);
            continue;
        }

        const blob = photoMeta.id ? await getStoredPhotoBlob(photoMeta.id) : null;
        if (!blob) {
            syncedMeta.push(photoMeta);
            continue;
        }

        const uploaded = await uploadPhotoToBucket({
            osId: operation.osId,
            photoMeta,
            blob,
        });

        syncedMeta.push({
            ...photoMeta,
            objectKey: uploaded.objectKey,
            url: uploaded.url,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
        });
    }

    return {
        ...operation,
        payload: {
            ...payload,
            photosMeta: syncedMeta,
        },
    };
};

export const syncPendingOperations = async () => {
    if (syncInFlight) {
        return getSyncState();
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        saveSyncState({
            pending: getPendingSyncCount(),
            lastResult: 'offline',
            message: 'Sem internet para sincronizar',
        });
        return getSyncState();
    }

    syncInFlight = true;
    let queue = loadQueue();

    try {
        while (queue.length > 0) {
            let current = queue[0];
            current = await ensureSyncedPhotoMeta(current);
            queue[0] = current;
            saveQueue(queue);

            await sendSyncOperation(current);

            if (current.type === 'UPSERT') {
                updateOSSyncStatus(current.osId, 'SINCRONIZADO', {
                    photosMeta: current.payload?.photosMeta || [],
                });
            }

            queue = queue.slice(1);
            saveQueue(queue);
            saveSyncState({ pending: queue.length });
        }

        const lastSyncAt = new Date().toISOString();
        await logProgress('SYNC', 'Fila offline sincronizada com sucesso', 'CHECK');
        saveSyncState({ pending: 0, lastSyncAt, lastResult: 'success', message: 'Sincronizacao concluida' });
        emitOSUpdated();
        return getSyncState();
    } catch (error) {
        console.error('Erro de sincronizacao', error);
        saveSyncState({
            pending: queue.length,
            lastResult: 'error',
            message: 'Falha ao sincronizar, fila mantida',
        });
        return getSyncState();
    } finally {
        syncInFlight = false;
    }
};
