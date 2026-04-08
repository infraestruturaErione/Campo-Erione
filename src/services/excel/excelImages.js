import { getPhoto } from '../storage';

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

const fetchRemotePhotoBuffer = async (url) => {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();

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
            tl: { col: 0, row: 0 },
            ext: { width: 180, height: 60 }
        });
    } catch (e) {
        console.error('Error adding logo to Excel:', e);
    }
};

export const drawPhotos = async (workbook, worksheet, os, startRow, theme) => {
    // Section Header
    worksheet.mergeCells(startRow, 1, startRow, 6);
    const phCell = worksheet.getCell(startRow, 1);
    phCell.value = 'Relatório Fotográfico';
    phCell.font = { ...theme.font.section, size: 14 };
    phCell.fill = theme.fill.section;
    phCell.alignment = { horizontal: 'center', vertical: 'middle' };
    phCell.border = theme.border.thin;
    worksheet.getRow(startRow).height = 35;

    const photosMeta = Array.isArray(os.photosMeta) && os.photosMeta.length > 0
        ? os.photosMeta
        : (os.photoIds || []).map((id) => ({ id, note: '' }));

    if (photosMeta.length === 0) return startRow + 1;

    // Parallelized loading for performance
    const photos = await Promise.all(
        photosMeta.map(async (item) => {
            const blob = item.id ? await getPhoto(item.id) : null;
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

            const remote = await fetchRemotePhotoBuffer(item.url);
            if (!remote) return null;
            return {
                ...remote,
                note: String(item.note || '').trim(),
            };
        })
    );

    let currentRow = startRow + 1;
    const photoWidth = 320;
    const photoHeight = 240;

    for (let i = 0; i < photos.length; i++) {
        const image = photos[i];
        if (!image) continue;

        const imageId = workbook.addImage({
            buffer: image.buffer,
            extension: image.extension,
        });

        const isLeft = i % 2 === 0;
        const col = isLeft ? 0 : 3;

        if (isLeft) worksheet.getRow(currentRow).height = 190;

        worksheet.addImage(imageId, {
            tl: { col: col, row: currentRow - 1 },
            ext: { width: photoWidth, height: photoHeight },
            editAs: 'oneCell'
        });

        // Add a border grid behind the photo to maintain structure
        const colRange = isLeft ? [1, 3] : [4, 6];
        for (let r = currentRow; r <= currentRow + 10; r++) {
            for (let c = colRange[0]; c <= colRange[1]; c++) {
                worksheet.getRow(r).getCell(c).border = theme.border.thin;
            }
        }

        const noteRow = currentRow + 10;
        worksheet.mergeCells(noteRow, colRange[0], noteRow, colRange[1]);
        const noteCell = worksheet.getCell(noteRow, colRange[0]);
        noteCell.value = `Obs: ${image.note || '-'}`;
        noteCell.font = { ...theme.font.normal, italic: true, size: 10 };
        noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

        if (!isLeft || i === photos.length - 1) {
            currentRow += 12; // Gap between rows
        }
    }

    return currentRow;
};
