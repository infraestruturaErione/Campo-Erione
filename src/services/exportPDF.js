import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { downloadGeneratedFile } from './nativeFileExport';
import { getStoredPhotoBlob } from './photoBlob';

const loadImage = (url) =>
    fetch(url)
        .then((res) => res.blob())
        .then((blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        }));

const sanitizeFileName = (value) =>
    String(value || 'Obra')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');

const detectImageFormat = (dataUrl) =>
    dataUrl.includes('data:image/png') ? 'PNG' : 'JPEG';

const fitTextInWidth = (doc, text, maxWidth) => {
    const raw = String(text || '');
    if (!raw) return '';

    if (doc.getTextWidth(raw) <= maxWidth) {
        return raw;
    }

    const ellipsis = '...';
    let result = raw;
    while (result.length > 0 && doc.getTextWidth(`${result}${ellipsis}`) > maxWidth) {
        result = result.slice(0, -1);
    }
    return `${result}${ellipsis}`;
};

const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const imageToJpegDataUrl = (imageSource) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Falha ao criar contexto de canvas'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = imageSource;
    });

const normalizePhotoForPdf = async (blob) => {
    if (!blob) return null;

    if (blob.type === 'image/png' || blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
        return blobToDataUrl(blob);
    }

    const rawDataUrl = await blobToDataUrl(blob);
    return imageToJpegDataUrl(rawDataUrl);
};

const fetchRemotePhotoDataUrl = async (url) => {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return normalizePhotoForPdf(blob);
    } catch {
        return null;
    }
};

const buildPdfDocument = async (os) => {
    const doc = new jsPDF();
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);
    let currentY = 12;

    const ensurePageSpace = (neededHeight) => {
        if (currentY + neededHeight > pageHeight - 20) {
            doc.addPage();
            currentY = 20;
            return true;
        }
        return false;
    };

    try {
        const logo = await loadImage('/logo_motiva.png');
        doc.addImage(logo, 'PNG', margin, currentY, 40, 18);
    } catch (error) {
        console.error('Logo load failed, using fallback', error);
        doc.setFillColor(59, 130, 246);
        doc.rect(margin, currentY, 30, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('motiva', margin + 5, currentY + 11);
    }

    doc.setTextColor(29, 78, 216);
    doc.setFontSize(17);
    doc.setFont(undefined, 'bold');
    doc.text('RELATORIO DIARIO DE OBRAS', pageWidth - margin, currentY + 8, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('Documento tecnico gerado pelo Erione Field', pageWidth - margin, currentY + 14, { align: 'right' });

    currentY += 24;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    const drawInfoBox = (label, value, x, y, width, height = 15) => {
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, width, height, 2, 2, 'S');
        doc.setFontSize(7);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(label, x + 3, y + 4.5);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(15, 23, 42);
        const safeValue = fitTextInWidth(doc, value || '-', width - 6);
        doc.text(safeValue, x + 3, y + 10.5);
    };

    const gap = 6;
    const wideLeft = 116;
    const narrowRight = contentWidth - wideLeft - gap;

    drawInfoBox('RESPONSAVEL ERIONE', os.responsavelMotiva, margin, currentY, wideLeft);
    drawInfoBox('DATA', new Date(os.createdAt).toLocaleDateString('pt-BR'), margin + wideLeft + gap, currentY, narrowRight);
    currentY += 19;

    drawInfoBox('RESPONSAVEL CONTRATADA', os.responsavelContratada, margin, currentY, contentWidth);
    currentY += 19;

    drawInfoBox('OBRA / EQUIPAMENTO', os.obraEquipamento, margin, currentY, contentWidth);
    currentY += 19;

    const halfWidth = (contentWidth - gap) / 2;
    drawInfoBox('HORARIO INICIO', os.horarioInicio, margin, currentY, halfWidth);
    drawInfoBox('HORARIO FIM', os.horarioFim, margin + halfWidth + gap, currentY, halfWidth);
    currentY += 19;

    drawInfoBox('LOCAL', os.local, margin, currentY, contentWidth);
    currentY += 18;

    const drawBoxSection = (title, content) => {
        const splitText = doc.splitTextToSize(content || '-', pageWidth - 28);
        const textHeight = splitText.length * 5;
        const totalHeight = textHeight + 18;

        ensurePageSpace(totalHeight);

        doc.setFillColor(232, 238, 249);
        doc.roundedRect(margin, currentY, pageWidth - 28, 6, 1.5, 1.5, 'F');
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 58, 138);
        doc.text(title, margin + 2.5, currentY + 4.5);

        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, pageWidth - 28, totalHeight, 1.5, 1.5);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(splitText, margin + 2.5, currentY + 12);

        currentY += totalHeight + 5;
    };

    drawBoxSection('Implantacao de Seguranca do Trabalho:', os.segurancaTrabalho);
    drawBoxSection('Descricao Detalhada:', os.descricao);
    drawBoxSection('Ocorrencias:', os.ocorrencias);

    ensurePageSpace(15);
    doc.setFillColor(232, 238, 249);
    doc.roundedRect(margin, currentY, contentWidth, 10, 1.5, 1.5, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text('Relatorio Fotografico', pageWidth / 2, currentY + 7, { align: 'center' });
    doc.roundedRect(margin, currentY, contentWidth, 10, 1.5, 1.5);
    currentY += 15;

    const photosMeta = Array.isArray(os.photosMeta) && os.photosMeta.length > 0
        ? os.photosMeta
        : (os.photoIds || []).map((id) => ({ id, note: '' }));

    if (photosMeta.length > 0) {
        let photoX = 14;
        const photoWidth = 85;
        const photoHeight = 52;
        const photoSlotHeight = 66;

        const photoData = await Promise.all(
            photosMeta.map(async (item) => {
                const localBlob = item.id ? await getStoredPhotoBlob(item.id) : null;
                const base64 = localBlob
                    ? await normalizePhotoForPdf(localBlob)
                    : await fetchRemotePhotoDataUrl(item.url);
                return {
                    base64,
                    note: String(item.note || '').trim(),
                };
            })
        );

        const validPhotos = photoData.filter((item) => Boolean(item.base64));

        for (let i = 0; i < validPhotos.length; i += 1) {
            const currentPhoto = validPhotos[i];
            ensurePageSpace(photoSlotHeight + 4);

            doc.addImage(currentPhoto.base64, detectImageFormat(currentPhoto.base64), photoX, currentY, photoWidth, photoHeight, undefined, 'FAST');
            doc.setDrawColor(203, 213, 225);
            doc.rect(photoX, currentY, photoWidth, photoHeight);

            doc.setFillColor(248, 250, 252);
            doc.rect(photoX, currentY + photoHeight, photoWidth, 8, 'F');
            const noteLabel = fitTextInWidth(doc, `Observacao: ${currentPhoto.note || '-'}`, photoWidth - 3);
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(noteLabel, photoX + 1.5, currentY + photoHeight + 5);

            if (i % 2 === 0 && i !== validPhotos.length - 1) {
                photoX = 110;
            } else {
                photoX = 14;
                currentY += photoSlotHeight;
            }
        }
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Erione Field | OS ${String(os.id || '').slice(0, 8)} | Pagina ${page}/${totalPages}`, margin, pageHeight - 7);
        doc.text(new Date(os.createdAt).toLocaleString('pt-BR'), pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    const safeObra = sanitizeFileName(os.obraEquipamento);
    const filename = `Relatorio_Obra_${safeObra}_${new Date(os.createdAt).getTime()}.pdf`;
    return { doc, filename };
};

export const exportToPDF = async (os) => {
    const { doc, filename } = await buildPdfDocument(os);
    const blob = doc.output('blob');
    return downloadGeneratedFile({
        blob,
        filename,
        title: `PDF da OS ${String(os.id || '').slice(-6)}`,
    });
};

export const exportToPDFBlob = async (os) => {
    const { doc, filename } = await buildPdfDocument(os);
    const blob = doc.output('blob');
    return { blob, filename };
};
