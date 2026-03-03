import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Loader2, Trash2 } from 'lucide-react';
import { exportToExcel } from '../services/exportExcel';
import { exportToPDF } from '../services/exportPDF';
import { removeOS } from '../services/osService';

export function OSActions({ os }) {
    const [exporting, setExporting] = useState(null);
    const [deleting, setDeleting] = useState(false);

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
                style={{ background: '#b91c1c', color: 'white' }}
                onClick={handleDelete}
                disabled={!!exporting || deleting}
            >
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 size={18} />}
                Apagar
            </button>
        </div>
    );
}
