import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getPhoto } from '../services/storage';
import { buildPhotoAccessUrl } from '../services/photoAccess';

export function OSPhotos({ osId, photoIds = [], photosMeta = [] }) {
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Cleanup function for memory management (Memory Leak Fix)
        return () => {
            previews.forEach((url) => {
                if (String(url).startsWith('blob:')) {
                    URL.revokeObjectURL(url);
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
                        return URL.createObjectURL(localBlob);
                    }
                    const remoteUrl = buildPhotoAccessUrl(item);
                    if (remoteUrl) {
                        return remoteUrl;
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
                {previews.map((src, idx) => (
                    <div key={`${osId}-${idx}`} className="photo-preview">
                        <img
                            src={src}
                            alt="os"
                            onClick={() => window.open(src, '_blank', 'noopener,noreferrer')}
                            style={{ cursor: 'zoom-in' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
