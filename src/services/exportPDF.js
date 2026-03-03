import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPhoto } from './storage';

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

export const exportToPDF = async (os) => {
    const doc = new jsPDF();
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 10;

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
        doc.addImage(logo, 'PNG', 10, currentY, 45, 20);
    } catch (error) {
        console.error('Logo load failed, using fallback', error);
        doc.setFillColor(59, 130, 246);
        doc.rect(10, currentY, 30, 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('motiva', 15, currentY + 12);
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('RELATORIO DIARIO DE OBRAS', pageWidth / 2 + 20, currentY + 10, { align: 'center' });

    currentY += 25;

    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(10, currentY, pageWidth - 10, currentY);
    currentY += 10;

    const drawField = (label, value, x, y, xEnd) => {
        const valueX = x + 40;
        const maxTextWidth = Math.max(10, xEnd - valueX - 2);
        const safeValue = fitTextInWidth(doc, value, maxTextWidth);

        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text(label, x, y);
        doc.setFont(undefined, 'normal');
        doc.text(safeValue, valueX, y);
        doc.setDrawColor(0);
        doc.line(valueX, y + 1, xEnd, y + 1);
    };

    const col1 = 14;
    const col2 = 130;

    drawField('RESPONSAVEL MOTIVA:', os.responsavelMotiva, col1, currentY, 110);
    drawField('DATA:', new Date(os.createdAt).toLocaleDateString('pt-BR'), col2, currentY, pageWidth - 14);

    currentY += 10;
    drawField('RESPONSAVEL CONTRATADA:', os.responsavelContratada, col1, currentY, pageWidth - 14);

    currentY += 10;
    drawField('OBRA/EQUIPAMENTO:', os.obraEquipamento, col1, currentY, pageWidth - 14);

    currentY += 10;
    drawField('HORARIO INICIO:', os.horarioInicio, col1, currentY, 110);
    drawField('HORARIO FIM:', os.horarioFim, col2, currentY, pageWidth - 14);

    currentY += 10;
    drawField('LOCAL:', os.local, col1, currentY, 110);
    drawField('SENTIDO:', os.sentido, col2, currentY, pageWidth - 14);

    currentY += 15;

    const drawBoxSection = (title, content) => {
        const splitText = doc.splitTextToSize(content || '-', pageWidth - 25);
        const textHeight = splitText.length * 5;
        const totalHeight = textHeight + 15;

        ensurePageSpace(totalHeight);

        doc.setFillColor(245, 245, 245);
        doc.rect(10, currentY, pageWidth - 20, 6, 'F');
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text(title, 12, currentY + 4.5);

        doc.setDrawColor(0);
        doc.rect(10, currentY, pageWidth - 20, totalHeight);

        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.text(splitText, 12, currentY + 12);

        currentY += totalHeight + 5;
    };

    drawBoxSection('Implantacao de Seguranca do Trabalho:', os.segurancaTrabalho);
    drawBoxSection('Descricao Detalhada:', os.descricao);
    drawBoxSection('Ocorrencias:', os.ocorrencias);

    ensurePageSpace(15);
    doc.setFillColor(245, 245, 245);
    doc.rect(10, currentY, pageWidth - 20, 10, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('Relatorio Fotografico', pageWidth / 2, currentY + 7, { align: 'center' });
    doc.rect(10, currentY, pageWidth - 20, 10);
    currentY += 15;

    if (os.photoIds && os.photoIds.length > 0) {
        let photoX = 14;
        const photoWidth = 85;
        const photoHeight = 60;

        const photoData = await Promise.all(
            os.photoIds.map(async (id) => {
                const blob = await getPhoto(id);
                return normalizePhotoForPdf(blob);
            })
        );

        const validPhotos = photoData.filter(Boolean);

        for (let i = 0; i < validPhotos.length; i += 1) {
            const base64 = validPhotos[i];
            ensurePageSpace(photoHeight + 5);

            doc.addImage(base64, detectImageFormat(base64), photoX, currentY, photoWidth, photoHeight, undefined, 'FAST');
            doc.setDrawColor(0);
            doc.rect(photoX, currentY, photoWidth, photoHeight);

            if (i % 2 === 0 && i !== validPhotos.length - 1) {
                photoX = 110;
            } else {
                photoX = 14;
                currentY += photoHeight + 10;
            }
        }
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`AppCampo | OS ${String(os.id || '').slice(0, 8)} | Pagina ${page}/${totalPages}`, margin, pageHeight - 7);
        doc.text(new Date(os.createdAt).toLocaleString('pt-BR'), pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    const safeObra = sanitizeFileName(os.obraEquipamento);
    doc.save(`Relatorio_Obra_${safeObra}_${new Date(os.createdAt).getTime()}.pdf`);
};
