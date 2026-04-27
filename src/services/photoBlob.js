import { getPhoto } from './storage';

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38];
const WEBP_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];

const hasSignature = (bytes, signature, offset = 0) =>
    signature.every((value, index) => bytes[offset + index] === value);

const inferMimeType = (bytes) => {
    if (!bytes || bytes.length < 12) return '';
    if (hasSignature(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
    if (hasSignature(bytes, PNG_SIGNATURE)) return 'image/png';
    if (hasSignature(bytes, GIF_SIGNATURE)) return 'image/gif';
    if (hasSignature(bytes, WEBP_RIFF_SIGNATURE, 0) && hasSignature(bytes, WEBP_WEBP_SIGNATURE, 8)) {
        return 'image/webp';
    }
    return '';
};

const base64ToBytes = (value) => {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

const bytesToBlob = (bytes, explicitType = '') => {
    if (!bytes) return null;
    const safeBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const detectedType = explicitType || inferMimeType(safeBytes) || 'image/jpeg';
    return new Blob([safeBytes], { type: detectedType });
};

const normalizePhotoBlob = async (value) => {
    if (!value) return null;

    if (value instanceof Blob) {
        const bytes = new Uint8Array(await value.arrayBuffer());
        return bytesToBlob(bytes, value.type);
    }

    if (value instanceof ArrayBuffer) {
        return bytesToBlob(new Uint8Array(value));
    }

    if (ArrayBuffer.isView(value)) {
        return bytesToBlob(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    }

    if (typeof value === 'string') {
        if (value.startsWith('data:')) {
            const [header, data] = value.split(',', 2);
            const mimeMatch = /^data:([^;]+);base64$/i.exec(header || '');
            return bytesToBlob(base64ToBytes(data), mimeMatch?.[1] || '');
        }
        return bytesToBlob(base64ToBytes(value));
    }

    if (typeof value === 'object') {
        if (value.blob) {
            return normalizePhotoBlob(value.blob);
        }
        if (typeof value.base64 === 'string') {
            return normalizePhotoBlob(value.base64);
        }
        if (Array.isArray(value.data)) {
            return bytesToBlob(new Uint8Array(value.data), value.type || '');
        }
    }

    return null;
};

export const getStoredPhotoBlob = async (id) => {
    if (!id) return null;
    const stored = await getPhoto(id);
    return normalizePhotoBlob(stored);
};

export const ensureStoredPhotoBlob = normalizePhotoBlob;
