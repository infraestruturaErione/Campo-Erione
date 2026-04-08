import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const required = [
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'S3_BUCKET',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
    console.error(`Variaveis ausentes no .env: ${missing.join(', ')}`);
    process.exit(1);
}

const client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
});

const bucket = process.env.S3_BUCKET;

try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    const list = await client.send(
        new ListObjectsV2Command({
            Bucket: bucket,
            MaxKeys: 5,
        })
    );

    console.log(`OK: bucket acessivel (${bucket})`);
    console.log(`Objetos encontrados (ate 5): ${list.KeyCount || 0}`);
    for (const item of list.Contents || []) {
        console.log(`- ${item.Key}`);
    }
} catch (error) {
    console.error('Falha ao validar bucket S3 (Linode/Akamai).');
    console.error(`Motivo: ${error?.name || 'ErroDesconhecido'} - ${error?.message || '-'}`);
    process.exit(1);
}
