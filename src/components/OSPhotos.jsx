import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getPhoto } from '../services/storage';
import { buildPhotoAccessUrl } from '../services/photoAccess';

const formatPhotoTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR');
};

export function OSPhotos({ osId, photoIds = [], photosMeta = [] }) {
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);

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
                        <img
                            src={photo.src}
                            alt="os"
                            onClick={() => window.open(photo.src, '_blank', 'noopener,noreferrer')}
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
        </div>
    );
}
