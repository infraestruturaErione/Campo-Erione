import React from 'react';
import { OSPhotos } from './OSPhotos';
import { OSActions } from './OSActions';

export function OSCard({ os, showCreator = false }) {
    const photoCount = Array.isArray(os.photosMeta) && os.photosMeta.length > 0
        ? os.photosMeta.length
        : (Array.isArray(os.photoIds) ? os.photoIds.length : 0);

    const syncLabel = os.statusSync || 'PENDENTE_SYNC';
    const syncClassName = syncLabel === 'SINCRONIZADO'
        ? 'soft-badge soft-badge-success'
        : syncLabel === 'SINCRONIZANDO'
            ? 'soft-badge soft-badge-info'
            : syncLabel === 'ERRO_SYNC'
                ? 'soft-badge soft-badge-warning'
                : 'soft-badge';

    return (
        <div className="card">
            <div className="os-header">
                <div>
                    <h3 style={{ color: 'var(--primary)' }}>{os.obraEquipamento}</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                        {new Date(os.createdAt).toLocaleString('pt-BR')} | OS #{os.id.toString().slice(-6)}
                    </p>
                </div>
                <span className={`badge ${os.status === 'Concluido' ? 'badge-done' : 'badge-pending'}`}>
                    {os.status}
                </span>
            </div>
            <div className="os-meta-strip">
                <span className={syncClassName}>Sync: {syncLabel}</span>
                <span className="soft-badge">Fotos: {photoCount}</span>
                <span className="soft-badge">Local: {os.local || '-'}</span>
            </div>
            {showCreator && (
                <p className="sync-status-text">
                    Criado por: {os.ownerName || os.ownerUsername || '-'}
                </p>
            )}

            <div className="os-grid os-grid-2">
                <div>
                    <label>Responsavel Contratada</label>
                    <p>{os.responsavelContratada}</p>
                </div>
                <div>
                    <label>Obra</label>
                    <p>{os.obraEquipamento}</p>
                </div>
            </div>

            <div className="os-grid os-grid-4">
                <div>
                    <label>Inicio</label>
                    <p>{os.horarioInicio}</p>
                </div>
                <div>
                    <label>Fim</label>
                    <p>{os.horarioFim}</p>
                </div>
                <div>
                    <label>Local</label>
                    <p>{os.local}</p>
                </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
                <label>Descricao Detalhada</label>
                <p style={{ whiteSpace: 'pre-wrap' }}>{os.descricao}</p>
            </div>

            {os.ocorrencias && (
                <div className="occurrence-box">
                    <label style={{ color: 'var(--warning)' }}>Ocorrencias</label>
                    <p>{os.ocorrencias}</p>
                </div>
            )}

            {((Array.isArray(os.photoIds) && os.photoIds.length > 0) || (Array.isArray(os.photosMeta) && os.photosMeta.length > 0)) && (
                <OSPhotos osId={os.id} photoIds={os.photoIds} photosMeta={os.photosMeta} />
            )}

            <OSActions os={os} />
        </div>
    );
}
