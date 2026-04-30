import { CapacitorHttp } from '@capacitor/core';
import { getOSList, saveOS } from './storage';
import { logProgress } from './progressLog';
import { emitOSUpdated } from '../events/eventBus';
import { buildAuthHeaders, fetchWithTimeout, isNativeApiRuntime, withApiBase } from './apiConfig';
import { getStoredPhotoBlob } from './photoBlob';

const SYNC_QUEUE_KEY = 'appcampo_sync_queue_v1';
const SYNC_STATE_KEY = 'appcampo_sync_state_v1';
const SYNC_ENDPOINT = import.meta.env.VITE_SYNC_ENDPOINT || withApiBase('/api/sync/os');
const MEDIA_UPLOAD_ENDPOINT = withApiBase('/api/media/upload');
const MEDIA_UPLOAD_NATIVE_ENDPOINT = withApiBase('/api/media/upload-base64');
let syncInFlight = false;

const safeParse = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

const loadQueue = () => {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return safeParse(raw, []);
};

const saveQueue = (queue) => {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    return queue;
};

const parseResponseError = async (response, fallbackMessage) => {
    const payload = await response.json().catch(() => null);
    return payload?.error || fallbackMessage;
};

const parseNativeResponseError = (response, fallbackMessage) => {
    const payload = response?.data;
    if (payload && typeof payload === 'object' && payload.error) {
        return payload.error;
    }
    return fallbackMessage;
};

const saveSyncState = (state) => {
    const current = getSyncState();
    const merged = { ...current, ...state };
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(merged));
    return merged;
};

export const getSyncState = () => {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    return safeParse(raw, {
        pending: 0,
        failed: 0,
        lastSyncAt: null,
        lastResult: 'idle',
        message: '',
        failedItems: [],
    });
};

export const getPendingSyncCount = () => loadQueue().length;

const updateOSSyncStatus = (osId, statusSync, patch = {}) => {
    const list = getOSList();
    const target = list.find((item) => item.id === osId);
    if (!target) return;

    saveOS({ ...target, ...patch, statusSync });
};

const toErrorMessage = (error, fallback = 'Falha ao sincronizar, fila mantida') =>
    error instanceof Error && error.message ? error.message : fallback;

const isConnectivityError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return (
        message.includes('failed to fetch')
        || message.includes('networkerror')
        || message.includes('network request failed')
        || message.includes('timeout')
        || message.includes('econnrefused')
        || (typeof navigator !== 'undefined' && navigator.onLine === false)
    );
};

const upsertQueueOperation = (operation) => {
    const queue = loadQueue();
    const next = queue.filter((item) => item.osId !== operation.osId);
    next.push(operation);
    saveQueue(next);
    saveSyncState({
        pending: next.length,
        failed: getSyncState().failed || 0,
        lastResult: 'queued',
        message: 'Fila offline atualizada',
    });
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
        failed: getSyncState().failed || 0,
        lastResult: 'queued',
        message: hadPendingUpsert ? 'OS removida localmente antes da sincronizacao' : 'Exclusao pendente de sincronizacao',
    });
    emitOSUpdated();
};

const sendSyncOperation = async (operation) => {
    if (isNativeApiRuntime) {
        const response = await CapacitorHttp.post({
            url: SYNC_ENDPOINT,
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            data: operation,
            connectTimeout: 15000,
            readTimeout: 15000,
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(parseNativeResponseError(response, `Falha HTTP ${response.status}`));
        }

        return;
    }

    const response = await fetchWithTimeout(SYNC_ENDPOINT, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(operation),
    }, 15000);

    if (!response.ok) {
        throw new Error(await parseResponseError(response, `Falha HTTP ${response.status}`));
    }
};

const blobToBase64 = async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
};

const uploadPhotoToBucket = async ({ osId, photoMeta, blob }) => {
    if (isNativeApiRuntime) {
        const extension = blob.type === 'image/png' ? 'png' : 'jpg';
        const filename = `${photoMeta.id || crypto.randomUUID()}.${extension}`;
        const response = await CapacitorHttp.post({
            url: MEDIA_UPLOAD_NATIVE_ENDPOINT,
            headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
            data: {
                osId,
                fileName: filename,
                mimeType: blob.type || 'image/jpeg',
                base64: await blobToBase64(blob),
            },
            connectTimeout: 30000,
            readTimeout: 30000,
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(parseNativeResponseError(response, `Falha no upload da imagem (HTTP ${response.status})`));
        }

        return response.data;
    }

    const formData = new FormData();
    const extension = blob.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${photoMeta.id || crypto.randomUUID()}.${extension}`;
    formData.append('file', blob, filename);
    formData.append('osId', osId);

    const response = await fetchWithTimeout(MEDIA_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: buildAuthHeaders(),
        credentials: 'include',
        body: formData,
    }, 30000);

    if (!response.ok) {
        throw new Error(await parseResponseError(response, `Falha no upload da imagem (HTTP ${response.status})`));
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
            failed: getSyncState().failed || 0,
            lastResult: 'offline',
            message: 'Sem internet para sincronizar',
        });
        return getSyncState();
    }

    syncInFlight = true;
    const queue = loadQueue();
    const retryQueue = [];
    const failedItems = [];
    let successCount = 0;

    try {
        saveSyncState({
            pending: queue.length,
            failed: 0,
            lastResult: 'syncing',
            message: queue.length > 0 ? 'Sincronizando fila offline...' : 'Fila vazia',
            failedItems: [],
        });

        for (let index = 0; index < queue.length; index += 1) {
            const operation = queue[index];

            try {
                if (operation.type === 'UPSERT') {
                    updateOSSyncStatus(operation.osId, 'SINCRONIZANDO');
                }

                const current = await ensureSyncedPhotoMeta(operation);

                await sendSyncOperation(current);

                if (current.type === 'UPSERT') {
                    updateOSSyncStatus(current.osId, 'SINCRONIZADO', {
                        photosMeta: current.payload?.photosMeta || [],
                    });
                }

                successCount += 1;

                const pendingCount = queue.length - successCount;
                saveSyncState({
                    pending: pendingCount,
                    failed: failedItems.length,
                    lastResult: 'syncing',
                    message: pendingCount > 0
                        ? `${successCount} registro(s) enviados. Continuando sincronizacao...`
                        : 'Ultimo registro da fila enviado.',
                    failedItems,
                });
            } catch (error) {
                const message = toErrorMessage(error);

                if (operation.type === 'UPSERT') {
                    updateOSSyncStatus(operation.osId, 'ERRO_SYNC');
                }

                failedItems.push({
                    osId: operation.osId,
                    type: operation.type,
                    message,
                });
                retryQueue.push(operation);

                if (isConnectivityError(error)) {
                    retryQueue.push(...queue.slice(index + 1));
                    saveQueue(retryQueue);
                    saveSyncState({
                        pending: retryQueue.length,
                        failed: failedItems.length,
                        lastResult: 'error',
                        message: message || 'Conexao interrompida durante a sincronizacao.',
                        failedItems,
                    });
                    emitOSUpdated();
                    return getSyncState();
                }
            }
        }

        saveQueue(retryQueue);
        const lastSyncAt = new Date().toISOString();
        if (failedItems.length === 0) {
            await logProgress('SYNC', 'Fila offline sincronizada com sucesso', 'CHECK');
            saveSyncState({
                pending: 0,
                failed: 0,
                lastSyncAt,
                lastResult: 'success',
                message: 'Sincronizacao concluida',
                failedItems: [],
            });
        } else {
            await logProgress('SYNC', `${successCount} registro(s) sincronizados e ${failedItems.length} permaneceram pendentes`, 'ACT');
            saveSyncState({
                pending: retryQueue.length,
                failed: failedItems.length,
                lastSyncAt,
                lastResult: successCount > 0 ? 'partial' : 'error',
                message: successCount > 0
                    ? `${successCount} registro(s) sincronizados. ${failedItems.length} item(ns) precisam de nova tentativa.`
                    : failedItems[0]?.message || 'Falha ao sincronizar, fila mantida',
                failedItems,
            });
        }
        emitOSUpdated();
        return getSyncState();
    } catch (error) {
        console.error('Erro de sincronizacao', error);
        saveQueue(queue);
        saveSyncState({
            pending: queue.length,
            failed: failedItems.length,
            lastResult: 'error',
            message: toErrorMessage(error),
            failedItems,
        });
        return getSyncState();
    } finally {
        syncInFlight = false;
    }
};
