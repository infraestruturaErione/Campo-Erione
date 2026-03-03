import React from 'react';
import { OSPhotos } from './OSPhotos';
import { OSActions } from './OSActions';

export function OSCard({ os }) {
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
            <p className="sync-status-text">
                Sync: {os.statusSync || 'PENDENTE_SYNC'}
            </p>

            <div className="os-grid os-grid-2">
                <div>
                    <label>Responsável Contratada</label>
                    <p>{os.responsavelContratada}</p>
                </div>
                <div>
                    <label>Obra/Equipamento</label>
                    <p>{os.obraEquipamento}</p>
                </div>
            </div>

            <div className="os-grid os-grid-4">
                <div>
                    <label>Início</label>
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
                <div>
                    <label>Sentido</label>
                    <p>{os.sentido}</p>
                </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
                <label>Descrição Detalhada</label>
                <p style={{ whiteSpace: 'pre-wrap' }}>{os.descricao}</p>
            </div>

            {os.ocorrencias && (
                <div className="occurrence-box">
                    <label style={{ color: 'var(--warning)' }}>Ocorrências</label>
                    <p>{os.ocorrencias}</p>
                </div>
            )}

            {os.photoIds && os.photoIds.length > 0 && (
                <OSPhotos osId={os.id} photoIds={os.photoIds} />
            )}

            <OSActions os={os} />
        </div>
    );
}
