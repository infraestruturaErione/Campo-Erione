import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, ChevronLeft, ChevronRight, Clock3, X } from 'lucide-react';
import { getPhoto } from '../services/storage';
import { buildPhotoAccessUrl } from '../services/photoAccess';

const formatPhotoTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR');
};

const formatPhotoTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export function OSPhotos({ osId, photoIds = [], photosMeta = [] }) {
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(null);

    useEffect(() => {
        // Cleanup function for memory management (Memory Leak Fix)
        return () => {
            previews.forEach((photo) => {
                if (String(photo?.src || '').startsWith('blob:')) {
                    URL.revokeObjectURL(photo.src);
                }
            });
        };
    }, [previews]);

    useEffect(() => {
        if (selectedIndex === null) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setSelectedIndex(null);
            } else if (event.key === 'ArrowRight') {
                setSelectedIndex((prev) => (prev === null ? 0 : Math.min(previews.length - 1, prev + 1)));
            } else if (event.key === 'ArrowLeft') {
                setSelectedIndex((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [previews.length, selectedIndex]);

    const loadPhotos = async () => {
        if (previews.length > 0 || loading) return;
        setLoading(true);

        try {
            const photoSources = photosMeta.length > 0
                ? photosMeta
                : photoIds.map((id) => ({ id }));

            const loaded = await Promise.all(
                photoSources.map(async (item) => {
                    const localBlob = item.id ? await getPhoto(item.id) : null;
                    if (localBlob) {
                        return {
                            src: URL.createObjectURL(localBlob),
                            note: item.note || '',
                            capturedAt: item.capturedAt || '',
                        };
                    }
                    const remoteUrl = buildPhotoAccessUrl(item);
                    if (remoteUrl) {
                        return {
                            src: remoteUrl,
                            note: item.note || '',
                            capturedAt: item.capturedAt || '',
                        };
                    }
                    return null;
                })
            );

            const newPreviews = loaded.filter(Boolean);

            setPreviews(newPreviews);
        } catch (error) {
            console.error('Error loading photos:', error);
        } finally {
            setLoading(false);
        }
    };

    const openGallery = async (index) => {
        if (previews.length === 0) {
            await loadPhotos();
        }
        setSelectedIndex(index);
    };

    const selectedPhoto = selectedIndex !== null ? previews[selectedIndex] : null;

    return (
        <div style={{ marginTop: '1rem' }}>
            <button
                className="btn"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: '#334155' }}
                onClick={loadPhotos}
                disabled={loading}
            >
                <ImageIcon size={14} style={{ marginRight: '6px' }} />
                {loading ? 'Carregando...' : `Ver Fotos (${photosMeta.length || photoIds.length})`}
            </button>

            <div className="photo-grid">
                {previews.map((photo, idx) => (
                    <div key={`${osId}-${idx}`} className="photo-preview">
                        <div className="photo-overlay-badges">
                            <span className="photo-overlay-badge">Foto {String(idx + 1).padStart(2, '0')}</span>
                            {photo.capturedAt ? (
                                <span className="photo-overlay-badge photo-overlay-badge-time">
                                    <Clock3 size={11} />
                                    {formatPhotoTime(photo.capturedAt)}
                                </span>
                            ) : null}
                        </div>
                        <img
                            src={photo.src}
                            alt="os"
                            onClick={() => openGallery(idx)}
                            style={{ cursor: 'zoom-in' }}
                        />
                        {(photo.capturedAt || photo.note) && (
                            <div className="photo-meta-caption">
                                {photo.capturedAt && <strong>{formatPhotoTimestamp(photo.capturedAt)}</strong>}
                                {photo.note && <span>{photo.note}</span>}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {selectedPhoto && (
                <div className="modal-backdrop" role="presentation" onClick={() => setSelectedIndex(null)}>
                    <div className="photo-lightbox" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <div className="photo-lightbox-header">
                            <div>
                                <span className="soft-badge">Foto {String((selectedIndex ?? 0) + 1).padStart(2, '0')} de {previews.length}</span>
                                {selectedPhoto.capturedAt ? (
                                    <p className="text-muted photo-lightbox-time">{formatPhotoTimestamp(selectedPhoto.capturedAt)}</p>
                                ) : null}
                            </div>
                            <button type="button" className="icon-btn" onClick={() => setSelectedIndex(null)} aria-label="Fechar galeria">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="photo-lightbox-frame">
                            <button
                                type="button"
                                className="photo-lightbox-nav"
                                onClick={() => setSelectedIndex((prev) => Math.max(0, (prev ?? 0) - 1))}
                                disabled={(selectedIndex ?? 0) <= 0}
                                aria-label="Foto anterior"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <img src={selectedPhoto.src} alt={`Foto ${selectedIndex + 1}`} className="photo-lightbox-image" />
                            <button
                                type="button"
                                className="photo-lightbox-nav"
                                onClick={() => setSelectedIndex((prev) => Math.min(previews.length - 1, (prev ?? 0) + 1))}
                                disabled={(selectedIndex ?? 0) >= previews.length - 1}
                                aria-label="Proxima foto"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <div className="photo-lightbox-footer">
                            <strong>Observacao da foto</strong>
                            <p>{selectedPhoto.note || 'Sem observacao registrada para esta imagem.'}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
