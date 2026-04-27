import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const EXPORTS_DIR = 'ErioneField';
const CACHE_EXPORTS_DIR = 'exports';

const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = String(reader.result || '');
            const [, base64 = ''] = result.split(',', 2);
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const triggerBrowserDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }, 500);
};

const saveToDirectory = async ({ directory, path, data }) => {
    await Filesystem.writeFile({
        path,
        data,
        directory,
        recursive: true,
    });
    return Filesystem.getUri({ path, directory });
};

const saveForNativeShare = async ({ blob, filename, title }) => {
    const base64 = await blobToBase64(blob);
    const documentPath = `${EXPORTS_DIR}/${filename}`;
    const cachePath = `${CACHE_EXPORTS_DIR}/${filename}`;

    let documentUri = null;
    try {
        if (Capacitor.getPlatform() === 'android') {
            const permissionStatus = await Filesystem.checkPermissions().catch(() => null);
            if (permissionStatus?.publicStorage === 'prompt') {
                await Filesystem.requestPermissions();
            }
        }

        const persisted = await saveToDirectory({
            directory: Directory.Documents,
            path: documentPath,
            data: base64,
        });
        documentUri = persisted.uri;
    } catch (error) {
        console.warn('Nao foi possivel salvar em Documentos. Seguindo com compartilhamento.', error);
    }

    const cached = await saveToDirectory({
        directory: Directory.Cache,
        path: cachePath,
        data: base64,
    });

    const shareSupport = await Share.canShare().catch(() => ({ value: false }));
    if (shareSupport.value) {
        await Share.share({
            title,
            text: documentUri
                ? `Arquivo salvo em Documentos/${EXPORTS_DIR}.`
                : 'Arquivo pronto para compartilhamento.',
            files: [cached.uri],
            dialogTitle: title,
        });
    }

    return {
        platform: 'native',
        filename,
        documentUri,
        message: documentUri
            ? `Arquivo salvo em Documentos/${EXPORTS_DIR} e enviado para compartilhamento.`
            : 'Arquivo pronto para compartilhamento no celular.',
    };
};

export const downloadGeneratedFile = async ({ blob, filename, title }) => {
    if (!Capacitor.isNativePlatform()) {
        triggerBrowserDownload(blob, filename);
        return {
            platform: 'web',
            filename,
        };
    }

    return saveForNativeShare({ blob, filename, title });
};
