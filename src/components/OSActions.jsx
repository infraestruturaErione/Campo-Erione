import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Loader2, Trash2, MessageCircle } from 'lucide-react';
import { exportToExcel, exportToExcelBlob } from '../services/exportExcel';
import { exportToPDF, exportToPDFBlob } from '../services/exportPDF';
import { removeOS } from '../services/osService';

export function OSActions({ os }) {
    const [exporting, setExporting] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [sharing, setSharing] = useState(false);

    const handleExport = async (type) => {
        setExporting(type);
        try {
            if (type === 'pdf') await exportToPDF(os);
            else await exportToExcel(os);
        } catch (error) {
            console.error(`Export ${type} error:`, error);
            alert('Erro na exportação. Tente novamente.');
        } finally {
            setExporting(null);
        }
    };

    const handleDelete = async () => {
        const shouldDelete = window.confirm(
            `Apagar esta OS?\n\nObra: ${os.obraEquipamento || '-'}\nResponsavel: ${os.responsavelContratada || '-'}`
        );

        if (!shouldDelete) return;

        setDeleting(true);
        try {
            await removeOS(os);
        } catch (error) {
            console.error('Delete OS error:', error);
            alert(error.message || 'Erro ao apagar OS.');
        } finally {
            setDeleting(false);
        }
    };

    const buildWhatsAppMessage = () => {
        const lines = [
            'Relatorio Diario de Obras',
            `OS: #${String(os.id || '').slice(-6)}`,
            `Obra/Equipamento: ${os.obraEquipamento || '-'}`,
            `Responsavel Contratada: ${os.responsavelContratada || '-'}`,
            `Status: ${os.status || '-'}`,
            `Data: ${new Date(os.createdAt).toLocaleString('pt-BR')}`,
        ];
        return lines.join('\n');
    };

    const handleShareWhatsApp = async () => {
        const message = buildWhatsAppMessage();
        const encoded = encodeURIComponent(message);
        const waLink = `https://wa.me/?text=${encoded}`;

        setSharing(true);
        try {
            if (navigator.share) {
                const [{ blob: pdfBlob, filename: pdfName }, { blob: excelBlob, filename: excelName }] = await Promise.all([
                    exportToPDFBlob(os),
                    exportToExcelBlob(os),
                ]);

                const files = [
                    new File([pdfBlob], pdfName, { type: 'application/pdf' }),
                    new File([excelBlob], excelName, {
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    }),
                ];

                if (navigator.canShare && navigator.canShare({ files })) {
                    await navigator.share({
                        title: `OS ${String(os.id || '').slice(-6)}`,
                        text: message,
                        files,
                    });
                    return;
                }

                await navigator.share({
                    title: `OS ${String(os.id || '').slice(-6)}`,
                    text: message,
                });
                return;
            }

            window.open(waLink, '_blank');
        } catch (error) {
            console.warn('Share cancelled or unavailable', error);
            window.open(waLink, '_blank');
        } finally {
            setSharing(false);
        }
    };

    return (
        <div className="export-actions">
            <button
                className="btn btn-primary"
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
            >
                {exporting === 'pdf' ? <Loader2 className="animate-spin" /> : <FileText size={18} />}
                PDF
            </button>
            <button
                className="btn"
                style={{ background: '#059669', color: 'white' }}
                onClick={() => handleExport('excel')}
                disabled={!!exporting}
            >
                {exporting === 'excel' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet size={18} />}
                Excel
            </button>
            <button
                className="btn"
                style={{ background: '#16a34a', color: 'white' }}
                onClick={handleShareWhatsApp}
                disabled={!!exporting || deleting || sharing}
            >
                {sharing ? <Loader2 className="animate-spin" /> : <MessageCircle size={18} />}
                WhatsApp
            </button>
            <button
                className="btn"
                style={{ background: '#b91c1c', color: 'white' }}
                onClick={handleDelete}
                disabled={!!exporting || deleting || sharing}
            >
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 size={18} />}
                Apagar
            </button>
        </div>
    );
}
