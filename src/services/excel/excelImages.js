import { getStoredPhotoBlob } from '../photoBlob';
import { fetchPhotoBlobFromMeta } from '../photoAccess';

const convertBlobToJpegBuffer = async (blob) => {
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    const jpegDataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Falha ao criar canvas'));
                return;
            }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });

    const response = await fetch(jpegDataUrl);
    return response.arrayBuffer();
};

const fetchRemotePhotoBuffer = async (photoMeta) => {
    try {
        const blob = await fetchPhotoBlobFromMeta(photoMeta);
        if (!blob) return null;

        if (blob.type === 'image/png' || blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
            return {
                buffer: await blob.arrayBuffer(),
                extension: blob.type === 'image/png' ? 'png' : 'jpeg',
            };
        }

        return {
            buffer: await convertBlobToJpegBuffer(blob),
            extension: 'jpeg',
        };
    } catch {
        return null;
    }
};

const formatPhotoTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR');
};

const normalizeNoteText = (value) => {
    const normalized = String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
    return normalized || '-';
};

const estimateLineCount = (value, maxCharsPerLine = 42) => {
    const normalized = normalizeNoteText(value);
    const rawLines = normalized.split('\n');
    return rawLines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / maxCharsPerLine)), 0);
};

export const addLogo = async (workbook, worksheet) => {
    try {
        const logoUrl = '/logo_motiva.png';
        const response = await fetch(logoUrl);
        const arrayBuffer = await response.arrayBuffer();

        const logoId = workbook.addImage({
            buffer: arrayBuffer,
            extension: 'png',
        });

        worksheet.addImage(logoId, {
            tl: { col: 0.1, row: 0.15 },
            ext: { width: 150, height: 42 }
        });
    } catch (e) {
        console.error('Error adding logo to Excel:', e);
    }
};

export const drawPhotos = async (workbook, worksheet, os, startRow, theme) => {
    worksheet.mergeCells(startRow, 1, startRow, 6);
    const phCell = worksheet.getCell(startRow, 1);
    phCell.value = 'Relatorio Fotografico';
    phCell.font = { ...theme.font.section, size: 14 };
    phCell.fill = theme.fill.section;
    phCell.alignment = { horizontal: 'center', vertical: 'middle' };
    phCell.border = theme.border.thin;
    worksheet.getRow(startRow).height = 35;

    const photosMeta = Array.isArray(os.photosMeta) && os.photosMeta.length > 0
        ? os.photosMeta
        : (os.photoIds || []).map((id) => ({ id, note: '' }));

    if (photosMeta.length === 0) return startRow + 1;

    const photos = await Promise.all(
        photosMeta.map(async (item) => {
            const blob = item.id ? await getStoredPhotoBlob(item.id) : null;
            if (blob) {
                if (blob.type === 'image/png' || blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
                    return {
                        buffer: await blob.arrayBuffer(),
                        extension: blob.type === 'image/png' ? 'png' : 'jpeg',
                        note: String(item.note || '').trim(),
                        capturedAt: item.capturedAt || '',
                    };
                }

                return {
                    buffer: await convertBlobToJpegBuffer(blob),
                    extension: 'jpeg',
                    note: String(item.note || '').trim(),
                    capturedAt: item.capturedAt || '',
                };
            }

            const remote = await fetchRemotePhotoBuffer(item);
            if (!remote) return null;
            return {
                ...remote,
                note: String(item.note || '').trim(),
                capturedAt: item.capturedAt || '',
            };
        })
    );

    let currentRow = startRow + 1;

    const paintBlockRange = (rowStart, rowEnd, colStart, colEnd, fill = theme.fill.value) => {
        for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
            for (let colIndex = colStart; colIndex <= colEnd; colIndex += 1) {
                const cell = worksheet.getRow(rowIndex).getCell(colIndex);
                cell.border = theme.border.subtle;
                cell.fill = fill;
            }
        }
    };

    const validPhotos = photos.filter(Boolean);

    for (let i = 0; i < validPhotos.length; i += 2) {
        const pair = validPhotos.slice(i, i + 2).map((image, pairIndex) => {
            const timestamp = formatPhotoTimestamp(image.capturedAt);
            const noteText = normalizeNoteText(image.note);
            const textBlock = `Obs: ${noteText}`;
            const estimatedLines = estimateLineCount(textBlock, validPhotos.slice(i, i + 2).length === 1 ? 88 : 40);
            const noteRows = Math.min(6, Math.max(2, estimatedLines));
            return {
                image,
                absoluteIndex: i + pairIndex,
                timestamp,
                noteText,
                noteRows,
                totalRows: 1 + 7 + 1 + noteRows + 1,
            };
        });

        const pairRows = Math.max(...pair.map((item) => item.totalRows));

        pair.forEach((item, pairIndex) => {
            const imageId = workbook.addImage({
                buffer: item.image.buffer,
                extension: item.image.extension,
            });

            const isSingleCard = pair.length === 1;
            const isLeft = pairIndex === 0;
            const col = isSingleCard ? 0 : (isLeft ? 0 : 3);
            const colRange = isSingleCard ? [1, 6] : (isLeft ? [1, 3] : [4, 6]);
            const titleRow = currentRow;
            const imageStartRow = currentRow + 1;
            const imageEndRow = currentRow + 7;
            const noteLabelRow = currentRow + 8;
            const noteBodyStartRow = currentRow + 9;
            const noteBodyEndRow = noteBodyStartRow + item.noteRows - 1;
            const blockEndRow = currentRow + pairRows - 1;

            worksheet.getRow(titleRow).height = 20;
            for (let rowIndex = imageStartRow; rowIndex <= imageEndRow; rowIndex += 1) {
                worksheet.getRow(rowIndex).height = rowIndex === imageStartRow ? 112 : 14;
            }
            worksheet.getRow(noteLabelRow).height = 18;
            for (let rowIndex = noteBodyStartRow; rowIndex <= noteBodyEndRow; rowIndex += 1) {
                worksheet.getRow(rowIndex).height = rowIndex === noteBodyStartRow ? 22 : 18;
            }
            for (let rowIndex = noteBodyEndRow + 1; rowIndex <= blockEndRow; rowIndex += 1) {
                worksheet.getRow(rowIndex).height = 10;
            }

            worksheet.mergeCells(titleRow, colRange[0], titleRow, colRange[1]);
            const titleCell = worksheet.getCell(titleRow, colRange[0]);
            titleCell.value = item.timestamp
                ? `FOTO ${String(item.absoluteIndex + 1).padStart(2, '0')} | ${item.timestamp}`
                : `FOTO ${String(item.absoluteIndex + 1).padStart(2, '0')}`;
            titleCell.font = theme.font.noteLabel;
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.fill = theme.fill.section;
            titleCell.border = theme.border.subtle;

            worksheet.addImage(imageId, {
                tl: { col: col + 0.16, row: imageStartRow - 0.82 },
                br: { col: isSingleCard ? 5.84 : col + 2.84, row: imageEndRow - 0.2 },
                editAs: 'oneCell'
            });

            paintBlockRange(imageStartRow, imageEndRow, colRange[0], colRange[1], theme.fill.value);
            paintBlockRange(noteLabelRow, noteBodyEndRow, colRange[0], colRange[1], theme.fill.note);
            paintBlockRange(noteBodyEndRow + 1, blockEndRow, colRange[0], colRange[1], theme.fill.value);

            worksheet.mergeCells(noteLabelRow, colRange[0], noteLabelRow, colRange[1]);
            const noteLabelCell = worksheet.getCell(noteLabelRow, colRange[0]);
            noteLabelCell.value = 'OBSERVACAO DA FOTO';
            noteLabelCell.font = theme.font.noteLabel;
            noteLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            noteLabelCell.fill = theme.fill.note;
            noteLabelCell.border = theme.border.subtle;

            worksheet.mergeCells(noteBodyStartRow, colRange[0], noteBodyEndRow, colRange[1]);
            const noteBodyCell = worksheet.getCell(noteBodyStartRow, colRange[0]);
            noteBodyCell.value = `Obs: ${item.noteText}`;
            noteBodyCell.font = theme.font.noteBody;
            noteBodyCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
            noteBodyCell.fill = theme.fill.note;
            noteBodyCell.border = theme.border.subtle;
        });

        currentRow += pairRows;
    }

    return currentRow;
};

