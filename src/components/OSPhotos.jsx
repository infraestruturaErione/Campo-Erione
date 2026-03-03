import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getPhoto } from '../services/storage';

export function OSPhotos({ osId, photoIds }) {
    const [previews, setPreviews] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Cleanup function for memory management (Memory Leak Fix)
        return () => {
            previews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previews]);

    const loadPhotos = async () => {
        if (previews.length > 0 || loading) return;
        setLoading(true);

        try {
            // Parallel loading (Performance Upgrade)
            const blobs = await Promise.all(
                photoIds.map(id => getPhoto(id))
            );

            const newPreviews = blobs
                .filter(Boolean)
                .map(blob => URL.createObjectURL(blob));

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
                {loading ? 'Carregando...' : `Ver Fotos (${photoIds.length})`}
            </button>

            <div className="photo-grid">
                {previews.map((src, idx) => (
                    <div key={idx} className="photo-preview">
                        <img src={src} alt="os" onClick={() => window.open(src)} style={{ cursor: 'zoom-in' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}
