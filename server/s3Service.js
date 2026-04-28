import { randomUUID } from 'crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION;
const accessKey = process.env.S3_ACCESS_KEY;
const secretKey = process.env.S3_SECRET_KEY;
const bucket = process.env.S3_BUCKET;
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

const hasS3Config = Boolean(endpoint && region && accessKey && secretKey && bucket);

const s3 = hasS3Config
    ? new S3Client({
        region,
        endpoint,
        forcePathStyle,
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
        },
    })
    : null;

const sanitizeFileName = (value) =>
    String(value || 'arquivo')
        .trim()
        .replace(/[^\w.\-]/g, '_');

const sanitizePathSegment = (value) =>
    String(value || 'sem-os')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 120) || 'sem-os';

const buildObjectUrl = (key) => {
    const base = new URL(endpoint);
    if (forcePathStyle) {
        return `${base.origin}/${bucket}/${key}`;
    }
    return `${base.protocol}//${bucket}.${base.host}/${key}`;
};

export const uploadImageToBucket = async ({ buffer, mimeType, originalName, filename, osId }) => {
    if (!s3 || !bucket) {
        throw new Error('S3 nao configurado no ambiente.');
    }

    const safeName = sanitizeFileName(originalName || filename);
    const safeOsId = sanitizePathSegment(osId);
    const key = `os/${safeOsId}/${randomUUID()}-${safeName}`;

    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: mimeType || 'application/octet-stream',
        })
    );

    return {
        objectKey: key,
        url: buildObjectUrl(key),
    };
};

export const getImageFromBucket = async (objectKey) => {
    if (!s3 || !bucket) {
        throw new Error('S3 nao configurado no ambiente.');
    }

    const safeKey = String(objectKey || '').trim();
    if (!safeKey) {
        throw new Error('Object key invalido.');
    }

    const response = await s3.send(
        new GetObjectCommand({
            Bucket: bucket,
            Key: safeKey,
        })
    );

    const bytes = await response.Body.transformToByteArray();
    return {
        buffer: Buffer.from(bytes),
        mimeType: response.ContentType || 'application/octet-stream',
    };
};
