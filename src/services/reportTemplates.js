export const REPORT_TEMPLATE_IDS = {
    ERIONE: 'erione',
    MOTIVA: 'motiva',
};

export const REPORT_TEMPLATES = {
    [REPORT_TEMPLATE_IDS.ERIONE]: {
        id: REPORT_TEMPLATE_IDS.ERIONE,
        label: 'Erione',
        logoUrl: '/logo-erione.png',
        fallbackText: 'erione',
        pdfLogo: { width: 48, height: 14 },
        excelLogo: { width: 150, height: 42 },
        workbookCompany: 'Erione',
    },
    [REPORT_TEMPLATE_IDS.MOTIVA]: {
        id: REPORT_TEMPLATE_IDS.MOTIVA,
        label: 'Motiva',
        logoUrl: '/logo_motiva.png',
        fallbackText: 'motiva',
        pdfLogo: { width: 40, height: 18 },
        excelLogo: { width: 150, height: 42 },
        workbookCompany: 'Motiva Engenharia',
    },
};

export const DEFAULT_REPORT_TEMPLATE = REPORT_TEMPLATE_IDS.ERIONE;
export const LEGACY_REPORT_TEMPLATE = REPORT_TEMPLATE_IDS.MOTIVA;

export const getReportTemplate = (templateId, fallback = LEGACY_REPORT_TEMPLATE) =>
    REPORT_TEMPLATES[templateId] || REPORT_TEMPLATES[fallback] || REPORT_TEMPLATES[REPORT_TEMPLATE_IDS.MOTIVA];

export const normalizeReportTemplate = (templateId, fallback = DEFAULT_REPORT_TEMPLATE) =>
    getReportTemplate(templateId, fallback).id;
