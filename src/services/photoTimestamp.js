const IMAGE_MIME_TYPE = 'image/jpeg';
const MAX_PHOTO_BYTES = 1024 * 1024;

const loadImageFromBlob = (blob) =>
    new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = (error) => {
            URL.revokeObjectURL(objectUrl);
            reject(error);
        };
        image.src = objectUrl;
    });

const canvasToBlob = (canvas, quality) =>
    new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Nao foi possivel converter a imagem com timestamp.'));
                return;
            }
            resolve(blob);
        }, IMAGE_MIME_TYPE, quality);
    });

const normalizeLine = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const formatTimestamp = (value) => {
    const date = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

    return new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(safeDate).replace(',', '');
};

const wrapLine = (context, text, maxWidth) => {
    const words = normalizeLine(text).split(' ').filter(Boolean);
    if (!words.length) return [];

    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (context.measureText(candidate).width <= maxWidth || !currentLine) {
            currentLine = candidate;
            return;
        }

        lines.push(currentLine);
        currentLine = word;
    });

    if (currentLine) lines.push(currentLine);
    return lines;
};

const drawTimestampOverlay = (context, canvas, metadata) => {
    const padding = Math.max(18, Math.round(canvas.width * 0.045));
    const fontSize = Math.max(22, Math.min(44, Math.round(canvas.width * 0.055)));
    const lineHeight = Math.round(fontSize * 1.18);
    const maxTextWidth = canvas.width - (padding * 2);
    const rawLines = [
        formatTimestamp(metadata.capturedAt),
        metadata.local,
        metadata.obraEquipamento,
        metadata.note,
    ].map(normalizeLine).filter(Boolean);

    context.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    const lines = rawLines.flatMap((line) => wrapLine(context, line, maxTextWidth));
    if (!lines.length) return;

    context.textAlign = 'right';
    context.textBaseline = 'alphabetic';
    context.fillStyle = '#ffffff';
    context.shadowColor = 'rgba(0, 0, 0, 0.82)';
    context.shadowBlur = Math.max(3, Math.round(fontSize * 0.12));
    context.shadowOffsetX = Math.max(1, Math.round(fontSize * 0.06));
    context.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.06));

    let y = canvas.height - padding;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        context.fillText(lines[index], canvas.width - padding, y);
        y -= lineHeight;
    }
};

export const stampPhotoTimestamp = async (blob, metadata = {}, maxBytes = MAX_PHOTO_BYTES) => {
    if (!(blob instanceof Blob)) {
        throw new Error('Arquivo de imagem invalido para timestamp.');
    }

    const image = await loadImageFromBlob(blob);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Nao foi possivel processar o timestamp da foto.');
    }

    let scale = 1;
    const maxDimension = 1600;
    const largestSide = Math.max(image.width, image.height);
    if (largestSide > maxDimension) {
        scale = maxDimension / largestSide;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const width = Math.max(320, Math.round(image.width * scale));
        const height = Math.max(320, Math.round(image.height * scale));
        canvas.width = width;
        canvas.height = height;
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        drawTimestampOverlay(context, canvas, metadata);

        const qualitySteps = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
        for (const quality of qualitySteps) {
            const stampedBlob = await canvasToBlob(canvas, quality);
            if (stampedBlob.size <= maxBytes) {
                return stampedBlob;
            }
        }

        scale *= 0.82;
    }

    throw new Error('A foto com timestamp nao conseguiu ficar abaixo de 1 MB.');
};
