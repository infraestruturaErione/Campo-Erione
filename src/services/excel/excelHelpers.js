export const styleCell = (cell, { font, fill, border, alignment }) => {
    if (font) cell.font = font;
    if (fill) cell.fill = fill;
    if (border) cell.border = border;
    if (alignment) cell.alignment = alignment;
};

export const drawRow = (worksheet, row, config, theme) => {
    const r = worksheet.getRow(row);
    r.height = 22;

    // Header Label
    const lbl = r.getCell(1);
    lbl.value = config.label1;
    styleCell(lbl, {
        font: theme.font.label,
        fill: theme.fill.label,
        border: theme.border.thin
    });

    // Value 1
    worksheet.mergeCells(row, 2, row, config.mergeEnd1);
    const val1 = r.getCell(2);
    val1.value = config.value1;
    styleCell(val1, {
        font: theme.font.base,
        alignment: { horizontal: 'center', vertical: 'middle' }
    });
    // Apply borders to all merged cells in value1
    for (let c = 2; c <= config.mergeEnd1; c++) {
        r.getCell(c).border = theme.border.thin;
    }

    // Optional Column 2 (Label2 + Value2)
    if (config.label2) {
        const lbl2 = r.getCell(config.label2Col || 5);
        lbl2.value = config.label2;
        styleCell(lbl2, {
            font: theme.font.label,
            fill: theme.fill.label,
            border: theme.border.thin
        });

        const val2 = r.getCell(config.value2Col || 6);
        val2.value = config.value2;
        styleCell(val2, {
            font: theme.font.base,
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: theme.border.thin
        });
    } else if (config.mergeEnd1 < 6) {
        // Complete borders for empty cells in the row
        for (let c = config.mergeEnd1 + 1; c <= 6; c++) {
            r.getCell(c).border = theme.border.thin;
        }
    }
};

export const drawBigBox = (worksheet, startRow, title, content, theme) => {
    // Label Header
    worksheet.mergeCells(startRow, 1, startRow, 6);
    const lbl = worksheet.getCell(startRow, 1);
    lbl.value = title;
    styleCell(lbl, {
        font: theme.font.label,
        fill: theme.fill.section,
        border: theme.border.thin
    });

    // Content
    worksheet.mergeCells(startRow + 1, 1, startRow + 3, 6);
    const val = worksheet.getCell(startRow + 1, 1);
    val.value = content;
    styleCell(val, {
        font: theme.font.base,
        alignment: { vertical: 'top', wrapText: true, indent: 1 }
    });

    // Borders for all cells in content box
    for (let r = startRow + 1; r <= startRow + 3; r++) {
        for (let c = 1; c <= 6; c++) {
            worksheet.getRow(r).getCell(c).border = theme.border.thin;
        }
    }

    return startRow + 4;
};
