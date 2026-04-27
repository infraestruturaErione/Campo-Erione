import { v4 as uuidv4 } from 'uuid';
import { saveOS, storePhoto, deleteOS, deletePhoto } from './storage';
import { logProgress } from './progressLog';
import { queueOSCreateOrUpdate, queueOSDelete, syncPendingOperations } from './syncService';
import { emitOSUpdated } from '../events/eventBus';

const normalizePhotoFile = async (file) => {
    if (!(file instanceof Blob)) return file;
    const bytes = await file.arrayBuffer();
    return new Blob([bytes], { type: file.type || 'image/jpeg' });
};

/**
 * Creates a new OS with specialized business logic.
 * Implements Atomic Transaction pattern (Compensation/Rollback).
 */
export async function createOS(formData, photos, currentUser) {
    const osId = uuidv4(); // Unique ID for offline/sync safety

    const osData = {
        ...formData,
        id: osId,
        ownerUserId: currentUser?.id || null,
        ownerUsername: currentUser?.username || '',
        ownerName: currentUser?.name || '',
        createdAt: new Date().toISOString(),
        status: formData.status || 'Em andamento',
        statusSync: 'PENDENTE_SYNC',
        photoIds: [],
        photosMeta: [],
    };

    try {
        // 1. Transaction Start: Save metadata
        saveOS(osData);

        // 2. Parallel Photo Storage
        // If this fails, we need to rollback step 1
        const photosMeta = await Promise.all(
            photos.map(async (photo) => {
                const photoId = `${osId}-${uuidv4()}`;
                const normalizedFile = await normalizePhotoFile(photo.file);
                await storePhoto(photoId, normalizedFile);
                return {
                    id: photoId,
                    note: String(photo.note || '').trim(),
                };
            })
        );

        // 3. Update OS with photo IDs (Commit-like step)
        osData.photoIds = photosMeta.map((item) => item.id);
        osData.photosMeta = photosMeta;
        saveOS(osData);

        // 4. Audit Logging (Event-Driven style soon)
        await logProgress(
            'CRIADO',
            `OS #${osId.slice(0, 8)} - Obra: ${formData.obraEquipamento}`
        );

        // 5. Queue offline synchronization
        queueOSCreateOrUpdate(osData);
        await syncPendingOperations();

        // 6. Notify observers via Event Bus (Decoupled)
        emitOSUpdated();

        return osData;
    } catch (error) {
        console.error('Transaction failed! Rolling back...', error);

        // Transactional Compensation (Rollback)
        deleteOS(osId);

        throw new Error('Falha ao criar relatório. As alterações foram revertidas.');
    }
}

export async function removeOS(os) {
    try {
        queueOSDelete(os);
        const photoIds = os?.photoIds || [];
        await Promise.all(photoIds.map((photoId) => deletePhoto(photoId)));
        deleteOS(os.id);

        await logProgress(
            'EXCLUIDO',
            `OS #${String(os.id || '').slice(0, 8)} - Obra: ${os.obraEquipamento || '-'}`
        );

        await syncPendingOperations();
        emitOSUpdated();
    } catch (error) {
        console.error('Falha ao excluir OS', error);
        throw new Error('Nao foi possivel apagar a OS.');
    }
}
