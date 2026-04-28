import { buildAuthHeaders, withApiBase } from './apiConfig';

export const buildPhotoAccessUrl = (photoMeta = {}) => {
    if (photoMeta.objectKey) {
        return `${withApiBase('/api/media/object')}?key=${encodeURIComponent(photoMeta.objectKey)}`;
    }
    return photoMeta.url || '';
};

export const fetchPhotoBlobFromMeta = async (photoMeta = {}) => {
    const url = buildPhotoAccessUrl(photoMeta);
    if (!url) return null;

    const response = await fetch(url, {
        headers: buildAuthHeaders(),
        credentials: 'include',
    });

    if (!response.ok) {
        return null;
    }

    return response.blob();
};
