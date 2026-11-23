import ExcelJS from 'exceljs';
import { theme } from './excel/excelTheme.js';
import { drawRow, drawBigBox } from './excel/excelHelpers.js';
import { addLogo, drawPhotos } from './excel/excelImages.js';
import { downloadGeneratedFile } from './nativeFileExport';
import { getReportTemplate } from './reportTemplates';

const sanitizeFileName = (value) =>
    String(value || 'Obra')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');

const buildExcelWorkbook = async (os) => {
    const reportTemplate = getReportTemplate(os.reportTemplate);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = `Erione Field - ${reportTemplate.workbookCompany}`;
    workbook.lastModifiedBy = 'Erione Field';
    workbook.created = new Date();
    workbook.company = reportTemplate.workbookCompany;

    const worksheet = workbook.addWorksheet('Relatorio de Obra');
    worksheet.properties.defaultRowHeight = 20;
    worksheet.pageSetup = {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    worksheet.headerFooter.oddFooter = '&LErione Field&RPagina &P de &N';

    worksheet.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];

    worksheet.columns = [
        { width: 22 },
        { width: 17 },
        { width: 17 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
    ];

    await addLogo(workbook, worksheet, reportTemplate);

    worksheet.mergeCells('C1:F1');
    const titleCell = worksheet.getCell('C1');
    titleCell.value = 'RELATORIO DIARIO DE OBRAS';
    titleCell.font = theme.font.title;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 50;

    worksheet.mergeCells('C2:F2');
    const subtitleCell = worksheet.getCell('C2');
    subtitleCell.value = 'Documento tecnico para acompanhamento operacional e envio ao cliente';
    subtitleCell.font = theme.font.subtitle;
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 18;

    drawRow(
        worksheet,
        4,
        {
            label1: 'RESPONSAVEL DA OBRA:',
            value1: os.responsavelMotiva || '-',
            mergeEnd1: 4,
            label2: 'DATA:',
            value2: new Date(os.createdAt).toLocaleDateString('pt-BR'),
        },
        theme
    );

    let detailsRow = 5;

    const registeredBy = String(os.ownerName || os.ownerUsername || '').trim();
    drawRow(worksheet, detailsRow, registeredBy && registeredBy !== '-'
        ? {
            label1: 'RESPONSAVEL ERIONE:', value1: os.responsavelContratada || '-', mergeEnd1: 4,
            label2: 'REGISTRADO POR:', value2: registeredBy,
            value2Align: 'left', wrapText2: true,
        }
        : {
            label1: 'RESPONSAVEL ERIONE:', value1: os.responsavelContratada || '-', mergeEnd1: 6,
        }, theme);
    detailsRow += 1;

    const equipe = String(os.equipe || '').trim();
    if (equipe) {
        const equipeLines = Math.max(1, Math.ceil(equipe.length / 85));
        drawRow(worksheet, detailsRow, {
            label1: 'EQUIPE:', value1: equipe, mergeEnd1: 6,
            wrapText: true,
            height: Math.max(24, equipeLines * 18),
        }, theme);
        detailsRow += 1;
    }

    drawRow(worksheet, detailsRow, {
        label1: 'OBRA:', value1: os.obraEquipamento || '-', mergeEnd1: 6,
    }, theme);
    detailsRow += 1;

    drawRow(worksheet, detailsRow, {
        label1: 'HORARIO INICIO:', value1: os.horarioInicio || '-', mergeEnd1: 4,
        label2: 'HORARIO FIM:', value2: os.horarioFim || '-',
    }, theme);
    detailsRow += 1;

    const condicaoClimatica = String(os.condicaoClimatica || '').trim();
    drawRow(worksheet, detailsRow, condicaoClimatica
        ? {
            label1: 'LOCAL:', value1: os.local || '-', mergeEnd1: 4,
            label2: 'CONDIÇÃO CLIMÁTICA:', value2: condicaoClimatica,
        }
        : {
            label1: 'LOCAL:', value1: os.local || '-', mergeEnd1: 6,
        }, theme);
    detailsRow += 1;

    let nextY = drawBigBox(worksheet, detailsRow + 1, 'Implantacao de Seguranca do Trabalho:', os.segurancaTrabalho || '-', theme);
    nextY = drawBigBox(worksheet, nextY + 1, 'Descricao Detalhada:', os.descricao || '-', theme);
    nextY = drawBigBox(worksheet, nextY + 1, 'Ocorrencias:', os.ocorrencias || '-', theme);

    await drawPhotos(workbook, worksheet, os, nextY + 1, theme);

    const safeObra = sanitizeFileName(os.obraEquipamento);
    const timestamp = new Date().getTime();
    const filename = `Relatorio_${safeObra}_${timestamp}.xlsx`;
    return { workbook, filename };
};

export const exportToExcel = async (os) => {
    const { workbook, filename } = await buildExcelWorkbook(os);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return downloadGeneratedFile({
        blob,
        filename,
        title: `Excel da OS ${String(os.id || '').slice(-6)}`,
    });
};

export const exportToExcelBlob = async (os) => {
    const { workbook, filename } = await buildExcelWorkbook(os);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return { blob, filename };
};
