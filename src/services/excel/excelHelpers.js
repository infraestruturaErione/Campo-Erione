export const styleCell = (cell, { font, fill, border, alignment }) => {
    if (font) cell.font = font;
    if (fill) cell.fill = fill;
    if (border) cell.border = border;
    if (alignment) cell.alignment = alignment;
};

export const drawRow = (worksheet, row, config, theme) => {
    const r = worksheet.getRow(row);
    r.height = 24;

    const lbl = r.getCell(1);
    lbl.value = config.label1;
    styleCell(lbl, {
        font: theme.font.label,
        fill: theme.fill.label,
        border: theme.border.subtle,
        alignment: { horizontal: 'left', vertical: 'middle' }
    });

    worksheet.mergeCells(row, 2, row, config.mergeEnd1);
    const val1 = r.getCell(2);
    val1.value = config.value1;
    styleCell(val1, {
        font: theme.font.normal,
        fill: theme.fill.value,
        alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
        border: theme.border.subtle
    });
    for (let c = 2; c <= config.mergeEnd1; c++) {
        r.getCell(c).border = theme.border.subtle;
        r.getCell(c).fill = theme.fill.value;
    }

    if (config.label2) {
        const lbl2 = r.getCell(config.label2Col || 5);
        lbl2.value = config.label2;
        styleCell(lbl2, {
            font: theme.font.label,
            fill: theme.fill.label,
            border: theme.border.subtle,
            alignment: { horizontal: 'left', vertical: 'middle' }
        });

        const val2 = r.getCell(config.value2Col || 6);
        val2.value = config.value2;
        styleCell(val2, {
            font: theme.font.normal,
            fill: theme.fill.value,
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: theme.border.subtle
        });
    } else if (config.mergeEnd1 < 6) {
        for (let c = config.mergeEnd1 + 1; c <= 6; c++) {
            r.getCell(c).border = theme.border.subtle;
            r.getCell(c).fill = theme.fill.value;
        }
    }
};

export const drawBigBox = (worksheet, startRow, title, content, theme) => {
    const normalized = String(content || '-')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim() || '-';
    const estimatedLines = normalized
        .split('\n')
        .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 92)), 0);
    const contentRows = Math.min(8, Math.max(3, estimatedLines));

    worksheet.mergeCells(startRow, 1, startRow, 6);
    const lbl = worksheet.getCell(startRow, 1);
    lbl.value = title;
    styleCell(lbl, {
        font: theme.font.label,
        fill: theme.fill.section,
        border: theme.border.subtle,
        alignment: { horizontal: 'left', vertical: 'middle' }
    });

    worksheet.mergeCells(startRow + 1, 1, startRow + contentRows, 6);
    const val = worksheet.getCell(startRow + 1, 1);
    val.value = normalized;
    styleCell(val, {
        font: theme.font.normal,
        fill: theme.fill.value,
        alignment: { vertical: 'top', wrapText: true, indent: 1 }
    });

    for (let r = startRow + 1; r <= startRow + contentRows; r++) {
        worksheet.getRow(r).height = r === startRow + 1 ? 24 : 20;
        for (let c = 1; c <= 6; c++) {
            worksheet.getRow(r).getCell(c).border = theme.border.subtle;
            worksheet.getRow(r).getCell(c).fill = theme.fill.value;
        }
    }

    return startRow + contentRows + 1;
};
