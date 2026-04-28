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
                    };
                }

                return {
                    buffer: await convertBlobToJpegBuffer(blob),
                    extension: 'jpeg',
                    note: String(item.note || '').trim(),
                };
            }

            const remote = await fetchRemotePhotoBuffer(item);
            if (!remote) return null;
            return {
                ...remote,
                note: String(item.note || '').trim(),
            };
        })
    );

    let currentRow = startRow + 1;
    const blockRows = 13;

    const paintBlockRange = (rowStart, rowEnd, colStart, colEnd, fill = theme.fill.value) => {
        for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
            for (let colIndex = colStart; colIndex <= colEnd; colIndex += 1) {
                const cell = worksheet.getRow(rowIndex).getCell(colIndex);
                cell.border = theme.border.subtle;
                cell.fill = fill;
            }
        }
    };

    for (let i = 0; i < photos.length; i++) {
        const image = photos[i];
        if (!image) continue;

        const imageId = workbook.addImage({
            buffer: image.buffer,
            extension: image.extension,
        });

        const isLeft = i % 2 === 0;
        const col = isLeft ? 0 : 3;
        const colRange = isLeft ? [1, 3] : [4, 6];
        const imageStartRow = currentRow + 1;
        const imageEndRow = currentRow + 8;
        const noteLabelRow = currentRow + 9;
        const noteBodyRow = currentRow + 10;
        const noteSpacerRow = currentRow + 11;
        const blockEndRow = currentRow + 12;

        worksheet.getRow(currentRow).height = 18;
        for (let rowIndex = imageStartRow; rowIndex <= imageEndRow; rowIndex += 1) {
            worksheet.getRow(rowIndex).height = rowIndex === imageStartRow ? 118 : 14;
        }
        worksheet.getRow(noteLabelRow).height = 16;
        worksheet.getRow(noteBodyRow).height = 34;
        worksheet.getRow(noteSpacerRow).height = 8;
        worksheet.getRow(blockEndRow).height = 6;

        worksheet.mergeCells(currentRow, colRange[0], currentRow, colRange[1]);
        const titleCell = worksheet.getCell(currentRow, colRange[0]);
        titleCell.value = `FOTO ${String(i + 1).padStart(2, '0')}`;
        titleCell.font = theme.font.noteLabel;
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = theme.fill.section;
        titleCell.border = theme.border.subtle;

        worksheet.addImage(imageId, {
            tl: { col: col + 0.14, row: imageStartRow - 0.88 },
            br: { col: col + 2.86, row: imageEndRow - 0.15 },
            editAs: 'oneCell'
        });

        paintBlockRange(imageStartRow, imageEndRow, colRange[0], colRange[1], theme.fill.value);
        paintBlockRange(noteLabelRow, noteBodyRow, colRange[0], colRange[1], theme.fill.note);
        paintBlockRange(noteSpacerRow, blockEndRow, colRange[0], colRange[1], theme.fill.value);

        worksheet.mergeCells(noteLabelRow, colRange[0], noteLabelRow, colRange[1]);
        const noteLabelCell = worksheet.getCell(noteLabelRow, colRange[0]);
        noteLabelCell.value = 'OBSERVACAO DA FOTO';
        noteLabelCell.font = theme.font.noteLabel;
        noteLabelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        noteLabelCell.fill = theme.fill.note;
        noteLabelCell.border = theme.border.subtle;

        worksheet.mergeCells(noteBodyRow, colRange[0], noteBodyRow, colRange[1]);
        const noteBodyCell = worksheet.getCell(noteBodyRow, colRange[0]);
        noteBodyCell.value = image.note || '-';
        noteBodyCell.font = theme.font.noteBody;
        noteBodyCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
        noteBodyCell.fill = theme.fill.note;
        noteBodyCell.border = theme.border.subtle;

        if (!isLeft || i === photos.length - 1) {
            currentRow += blockRows;
        }
    }

    return currentRow;
};

