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

const normalizeTextField = (value) => String(value || '').trim();

const normalizeFormData = (formData) => ({
    ...formData,
    responsavelMotiva: normalizeTextField(formData.responsavelMotiva),
    responsavelContratada: normalizeTextField(formData.responsavelContratada),
    obraEquipamento: normalizeTextField(formData.obraEquipamento),
    horarioInicio: normalizeTextField(formData.horarioInicio),
    horarioFim: normalizeTextField(formData.horarioFim),
    local: normalizeTextField(formData.local),
    segurancaTrabalho: normalizeTextField(formData.segurancaTrabalho),
    descricao: normalizeTextField(formData.descricao),
    ocorrencias: normalizeTextField(formData.ocorrencias),
    status: normalizeTextField(formData.status) || 'Em andamento',
});

export async function createOS(formData, photos, currentUser) {
    const osId = uuidv4();
    const normalizedFormData = normalizeFormData(formData);

    const osData = {
        ...normalizedFormData,
        id: osId,
        ownerUserId: currentUser?.id || null,
        ownerUsername: currentUser?.username || '',
        ownerName: currentUser?.name || '',
        createdAt: new Date().toISOString(),
        status: normalizedFormData.status,
        statusSync: 'PENDENTE_SYNC',
        photoIds: [],
        photosMeta: [],
    };

    try {
        saveOS(osData);

        const photosMeta = await Promise.all(
            photos.map(async (photo) => {
                const photoId = `${osId}-${uuidv4()}`;
                const normalizedFile = await normalizePhotoFile(photo.file);
                await storePhoto(photoId, normalizedFile);
                return {
                    id: photoId,
                    note: String(photo.note || '').trim(),
                    capturedAt: photo.capturedAt || new Date().toISOString(),
                };
            })
        );

        osData.photoIds = photosMeta.map((item) => item.id);
        osData.photosMeta = photosMeta;
        saveOS(osData);

        await logProgress('CRIADO', `OS #${osId.slice(0, 8)} - Obra: ${normalizedFormData.obraEquipamento}`);

        queueOSCreateOrUpdate(osData);
        await syncPendingOperations();
        emitOSUpdated();

        return osData;
    } catch (error) {
        console.error('Transaction failed! Rolling back...', error);
        await Promise.allSettled((osData.photoIds || []).map((photoId) => deletePhoto(photoId)));
        deleteOS(osId);
        throw new Error('Falha ao criar relatorio. As alteracoes foram revertidas.');
    }
}

export async function removeOS(os) {
    try {
        queueOSDelete(os);
        const photoIds = os?.photoIds || [];
        await Promise.all(photoIds.map((photoId) => deletePhoto(photoId)));
        deleteOS(os.id);

        await logProgress('EXCLUIDO', `OS #${String(os.id || '').slice(0, 8)} - Obra: ${os.obraEquipamento || '-'}`);

        await syncPendingOperations();
        emitOSUpdated();
    } catch (error) {
        console.error('Falha ao excluir OS', error);
        throw new Error('Nao foi possivel apagar a OS.');
    }
}
