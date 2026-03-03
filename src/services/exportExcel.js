import ExcelJS from 'exceljs';
import { theme } from './excel/excelTheme.js';
import { drawRow, drawBigBox } from './excel/excelHelpers.js';
import { addLogo, drawPhotos } from './excel/excelImages.js';
import { downloadExcel } from './excel/excelDownloader.js';

const sanitizeFileName = (value) =>
    String(value || 'Obra')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_');

export const exportToExcel = async (os) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AppCampo - Motiva Engenharia';
    workbook.lastModifiedBy = 'AppCampo';
    workbook.created = new Date();
    workbook.company = 'Motiva Engenharia';

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
    worksheet.headerFooter.oddFooter = '&LAppCampo&RPagina &P de &N';

    worksheet.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }];

    worksheet.columns = [
        { width: 30 },
        { width: 15 },
        { width: 25 },
        { width: 15 },
        { width: 20 },
        { width: 20 },
    ];

    await addLogo(workbook, worksheet);

    worksheet.mergeCells('C1:F1');
    const titleCell = worksheet.getCell('C1');
    titleCell.value = 'RELATORIO DIARIO DE OBRAS';
    titleCell.font = theme.font.title;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 65;

    drawRow(
        worksheet,
        4,
        {
            label1: 'RESPONSAVEL MOTIVA:',
            value1: os.responsavelMotiva || '-',
            mergeEnd1: 4,
            label2: 'DATA:',
            value2: new Date(os.createdAt).toLocaleDateString('pt-BR'),
        },
        theme
    );

    drawRow(worksheet, 5, {
        label1: 'RESPONSAVEL CONTRATADA:', value1: os.responsavelContratada || '-', mergeEnd1: 6,
    }, theme);

    drawRow(worksheet, 6, {
        label1: 'OBRA/EQUIPAMENTO:', value1: os.obraEquipamento || '-', mergeEnd1: 6,
    }, theme);

    drawRow(worksheet, 7, {
        label1: 'HORARIO INICIO:', value1: os.horarioInicio || '-', mergeEnd1: 4,
        label2: 'HORARIO FIM:', value2: os.horarioFim || '-',
    }, theme);

    drawRow(worksheet, 8, {
        label1: 'LOCAL:', value1: os.local || '-', mergeEnd1: 4,
        label2: 'SENTIDO:', value2: os.sentido || '-',
    }, theme);

    let nextY = drawBigBox(worksheet, 10, 'Implantacao de Seguranca do Trabalho:', os.segurancaTrabalho || '-', theme);
    nextY = drawBigBox(worksheet, nextY + 1, 'Descricao Detalhada:', os.descricao || '-', theme);
    nextY = drawBigBox(worksheet, nextY + 1, 'Ocorrencias:', os.ocorrencias || '-', theme);

    await drawPhotos(workbook, worksheet, os, nextY + 1, theme);

    const safeObra = sanitizeFileName(os.obraEquipamento);
    const timestamp = new Date().getTime();
    await downloadExcel(workbook, `Relatorio_${safeObra}_${timestamp}.xlsx`);
};
