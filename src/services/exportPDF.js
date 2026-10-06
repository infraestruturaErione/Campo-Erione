import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { downloadGeneratedFile } from './nativeFileExport';
import { getStoredPhotoBlob } from './photoBlob';
import { fetchPhotoBlobFromMeta } from './photoAccess';
import { getReportTemplate } from './reportTemplates';

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

const fetchRemotePhotoDataUrl = async (photoMeta) => {
    try {
        const blob = await fetchPhotoBlobFromMeta(photoMeta);
        if (!blob) return null;
        return normalizePhotoForPdf(blob);
    } catch {
        return null;
    }
};

const sanitizeMultilineText = (value, fallback = '-') => {
    const normalized = String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
    return normalized || fallback;
};

const formatPhotoTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR');
};

const fitImageInBox = (image, boxWidth, boxHeight) => {
    const imageWidth = Number(image?.width || 0);
    const imageHeight = Number(image?.height || 0);
    if (!imageWidth || !imageHeight) return null;

    const scale = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
    return {
        width: imageWidth * scale,
        height: imageHeight * scale,
    };
};

const PDF_RESPONSIBLE_FIELDS = {
    obra: {
        label: 'RESPONSAVEL DA OBRA',
        source: 'responsavelMotiva',
    },
    erione: {
        label: 'RESPONSAVEL ERIONE',
        source: 'responsavelContratada',
    },
};

export const buildPdfDocument = async (os) => {
    const reportTemplate = getReportTemplate(os.reportTemplate);
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
        const logo = await loadImage(reportTemplate.logoUrl);
        doc.addImage(logo, 'PNG', margin, currentY, reportTemplate.pdfLogo.width, reportTemplate.pdfLogo.height);
    } catch (error) {
        console.error('Logo load failed, using fallback', error);
        doc.setFillColor(59, 130, 246);
        doc.rect(margin, currentY, 30, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(reportTemplate.fallbackText, margin + 5, currentY + 11);
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

    drawInfoBox(PDF_RESPONSIBLE_FIELDS.obra.label, os[PDF_RESPONSIBLE_FIELDS.obra.source], margin, currentY, wideLeft);
    drawInfoBox('DATA', new Date(os.createdAt).toLocaleDateString('pt-BR'), margin + wideLeft + gap, currentY, narrowRight);
    currentY += 19;

    drawInfoBox(PDF_RESPONSIBLE_FIELDS.erione.label, os[PDF_RESPONSIBLE_FIELDS.erione.source], margin, currentY, contentWidth);
    currentY += 19;

    drawInfoBox('OBRA', os.obraEquipamento, margin, currentY, contentWidth);
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

    const photosMeta = Array.isArray(os.photosMeta) && os.photosMeta.length > 0
        ? os.photosMeta
        : (os.photoIds || []).map((id) => ({ id, note: '' }));

    const columnGap = 8;
    const photoWidth = (contentWidth - columnGap) / 2;
    const cardPadding = 3.5;
    const cardHeaderHeight = 7;
    const imageAreaHeight = 54;
    const timestampHeight = 8;
    const noteLabelHeight = 5;
    const noteLineHeight = 4.2;
    const visibleNoteLineCount = 3;
    const cardHeight = cardHeaderHeight + imageAreaHeight + timestampHeight + noteLabelHeight + (visibleNoteLineCount * noteLineHeight) + 4;
    const photoData = await Promise.all(
        photosMeta.map(async (item, index) => {
            const localBlob = item.id ? await getStoredPhotoBlob(item.id) : null;
            const base64 = localBlob
                ? await normalizePhotoForPdf(localBlob)
                : await fetchRemotePhotoDataUrl(item);
            return {
                base64,
                note: String(item.note || '').trim(),
                capturedAt: item.capturedAt || '',
                index: index + 1,
            };
        })
    );

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    const cards = photoData.map((photo) => {
        const note = sanitizeMultilineText(photo.note, 'Sem observação registrada.');
        const noteLines = doc.splitTextToSize(note, photoWidth - (cardPadding * 2));
        const hasOverflow = noteLines.length > visibleNoteLineCount;
        return {
            ...photo,
            label: `FOTO ${String(photo.index).padStart(2, '0')}`,
            timestamp: formatPhotoTimestamp(photo.capturedAt) || 'Horário não registrado',
            visibleNoteLines: hasOverflow
                ? [...noteLines.slice(0, visibleNoteLineCount - 1), 'Continua em observações complementares.']
                : noteLines,
            overflowNote: hasOverflow ? note : '',
        };
    });

    const sectionHeight = 10;
    const firstRowHeight = cards.length > 0 ? cardHeight : 15;
    ensurePageSpace(sectionHeight + 5 + firstRowHeight);
    doc.setFillColor(232, 238, 249);
    doc.roundedRect(margin, currentY, contentWidth, sectionHeight, 1.5, 1.5, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text('Relatório Fotográfico', pageWidth / 2, currentY + 7, { align: 'center' });
    doc.roundedRect(margin, currentY, contentWidth, sectionHeight, 1.5, 1.5);
    currentY += sectionHeight + 5;

    if (cards.length === 0) {
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(margin, currentY, contentWidth, 15, 2, 2, 'S');
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text('Nenhum registro fotográfico disponível.', pageWidth / 2, currentY + 9, { align: 'center' });
        currentY += 20;
    }

    const overflowNotes = [];
    for (let i = 0; i < cards.length; i += 2) {
        const rowCards = cards.slice(i, i + 2);
        ensurePageSpace(cardHeight + 4);

        rowCards.forEach((card, columnIndex) => {
            const photoX = margin + ((photoWidth + columnGap) * columnIndex);
            const cardY = currentY;
            const imageX = photoX + 0.8;
            const imageY = cardY + cardHeaderHeight + 0.8;
            const imageWidth = photoWidth - 1.6;
            const imageHeight = imageAreaHeight - 1.6;
            const timestampY = cardY + cardHeaderHeight + imageAreaHeight;
            const noteY = timestampY + timestampHeight;

            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(photoX, cardY, photoWidth, cardHeight, 2, 2, 'S');

            doc.setFillColor(232, 238, 249);
            doc.roundedRect(photoX, cardY, photoWidth, cardHeaderHeight, 2, 2, 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 58, 138);
            doc.text(card.label, photoX + cardPadding, cardY + 4.8);

            doc.setFillColor(241, 245, 249);
            doc.rect(imageX, imageY, imageWidth, imageHeight, 'F');
            doc.setDrawColor(203, 213, 225);
            doc.rect(imageX, imageY, imageWidth, imageHeight);

            if (card.base64) {
                try {
                    const dimensions = fitImageInBox(doc.getImageProperties(card.base64), imageWidth, imageHeight);
                    if (!dimensions) throw new Error('Dimensões inválidas');
                    const centeredX = imageX + ((imageWidth - dimensions.width) / 2);
                    const centeredY = imageY + ((imageHeight - dimensions.height) / 2);
                    doc.addImage(card.base64, detectImageFormat(card.base64), centeredX, centeredY, dimensions.width, dimensions.height, undefined, 'FAST');
                } catch {
                    doc.setFont(undefined, 'bold');
                    doc.setFontSize(9);
                    doc.setTextColor(100, 116, 139);
                    doc.text('Imagem indisponível', photoX + (photoWidth / 2), imageY + (imageHeight / 2), { align: 'center' });
                }
            } else {
                doc.setFont(undefined, 'bold');
                doc.setFontSize(9);
                doc.setTextColor(100, 116, 139);
                doc.text('Imagem indisponível', photoX + (photoWidth / 2), imageY + (imageHeight / 2), { align: 'center' });
            }

            doc.setFillColor(248, 250, 252);
            doc.rect(photoX, timestampY, photoWidth, timestampHeight, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.line(photoX, timestampY, photoX + photoWidth, timestampY);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`REGISTRO: ${fitTextInWidth(doc, card.timestamp, photoWidth - (cardPadding * 2) - 18)}`, photoX + cardPadding, timestampY + 5);

            doc.setFillColor(255, 255, 255);
            doc.rect(photoX, noteY, photoWidth, cardHeight - (noteY - cardY), 'F');
            doc.setFont(undefined, 'bold');
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.text('OBSERVAÇÃO', photoX + cardPadding, noteY + 3.5);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(card.visibleNoteLines, photoX + cardPadding, noteY + noteLabelHeight + 3.5);

            if (card.overflowNote) {
                overflowNotes.push(card);
            }
        });

        currentY += cardHeight + 5;
    }

    if (overflowNotes.length > 0) {
        ensurePageSpace(15);
        doc.setFillColor(232, 238, 249);
        doc.roundedRect(margin, currentY, contentWidth, 8, 1.5, 1.5, 'F');
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 58, 138);
        doc.text('Observações complementares', margin + 3, currentY + 5.4);
        currentY += 12;

        overflowNotes.forEach((card) => {
            const lines = doc.splitTextToSize(`${card.label}: ${card.overflowNote}`, contentWidth - 6);
            while (lines.length > 0) {
                ensurePageSpace(10);
                const maxLines = Math.max(1, Math.floor((pageHeight - 20 - currentY) / 4.5));
                const visibleLines = lines.splice(0, maxLines);
                doc.setFont(undefined, 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(15, 23, 42);
                doc.text(visibleLines, margin + 3, currentY + 4);
                currentY += (visibleLines.length * 4.5) + 4;
            }
        });
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Erione Field | OS ${String(os.id || '').slice(0, 8)} | Página ${page}/${totalPages}`, margin, pageHeight - 7);
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
