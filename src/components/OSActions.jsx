import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Loader2, Trash2, MessageCircle } from 'lucide-react';
import { exportToExcel, exportToExcelBlob } from '../services/exportExcel';
import { exportToPDF, exportToPDFBlob } from '../services/exportPDF';
import { removeOS } from '../services/osService';
import { useToast } from './ui/ToastProvider';
import ConfirmDialog from './ui/ConfirmDialog';

export function OSActions({ os }) {
    const toast = useToast();
    const [exporting, setExporting] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const handleExport = async (type) => {
        setExporting(type);
        try {
            const result = type === 'pdf' ? await exportToPDF(os) : await exportToExcel(os);
            if (result?.platform === 'native' && result.message) {
                toast.success(result.message, type === 'pdf' ? 'PDF pronto' : 'Excel pronto');
            }
        } catch (error) {
            console.error(`Export ${type} error:`, error);
            toast.error('Erro na exportacao. Tente novamente.', 'Exportacao');
        } finally {
            setExporting(null);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await removeOS(os);
            setConfirmDeleteOpen(false);
            toast.success('OS apagada com sucesso.', 'Historico');
        } catch (error) {
            console.error('Delete OS error:', error);
            toast.error(error.message || 'Erro ao apagar OS.', 'Historico');
        } finally {
            setDeleting(false);
        }
    };

    const summarizeText = (value, maxLength = 110) => {
        const normalized = String(value || '-').replace(/\s+/g, ' ').trim();
        if (normalized.length <= maxLength) {
            return normalized;
        }
        return `${normalized.slice(0, maxLength - 3)}...`;
    };

    const buildWhatsAppMessage = () => {
        const horario = `${os.horarioInicio || '-'} as ${os.horarioFim || '-'}`;
        const lines = [
            'RELATORIO DIARIO DE OBRAS',
            '',
            `Checklist da OS #${String(os.id || '').slice(-6)}`,
            `[x] Obra: ${os.obraEquipamento || '-'}`,
            `[x] Responsavel Erione: ${os.responsavelMotiva || '-'}`,
            `[x] Responsavel Contratada: ${os.responsavelContratada || '-'}`,
            `[x] Data: ${new Date(os.createdAt).toLocaleDateString('pt-BR')}`,
            `[x] Horario: ${horario}`,
            `[x] Local: ${os.local || '-'}`,
            `[x] Status: ${os.status || '-'}`,
            `[x] Seguranca: ${summarizeText(os.segurancaTrabalho, 90)}`,
            `[x] Descricao: ${summarizeText(os.descricao, 90)}`,
            `[x] Ocorrencias: ${summarizeText(os.ocorrencias, 90)}`,
            `[x] Fotos registradas: ${Array.isArray(os.photosMeta) ? os.photosMeta.length : (os.photoIds || []).length}`,
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
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={!!exporting || deleting || sharing}
            >
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 size={18} />}
                Apagar
            </button>

            <ConfirmDialog
                open={confirmDeleteOpen}
                title="Apagar este relatorio?"
                message="Essa OS sera removida do historico local. Use essa acao somente quando o registro nao for mais necessario."
                confirmLabel="Apagar OS"
                cancelLabel="Voltar"
                loading={deleting}
                onCancel={() => setConfirmDeleteOpen(false)}
                onConfirm={handleDelete}
            >
                <div className="confirm-dialog-user-card">
                    <strong>{os.obraEquipamento || 'Obra nao informada'}</strong>
                    <span>Responsavel: {os.responsavelContratada || '-'}</span>
                    <span>Local: {os.local || '-'}</span>
                </div>
            </ConfirmDialog>
        </div>
    );
}
