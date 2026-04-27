import React from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    tone = 'danger',
    loading = false,
    onCancel,
    onConfirm,
    children,
}) {
    if (!open) return null;

    return (
        <div className="modal-backdrop" role="presentation" onClick={loading ? undefined : onCancel}>
            <div className="modal-card confirm-modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                <div className="modal-header">
                    <div className={`confirm-dialog-icon ${tone === 'danger' ? 'is-danger' : 'is-info'}`}>
                        <AlertTriangle size={18} />
                    </div>
                    <button type="button" className="icon-btn" onClick={onCancel} aria-label="Fechar modal" disabled={loading}>
                        <X size={16} />
                    </button>
                </div>

                <div className="confirm-dialog-copy">
                    <h2>{title}</h2>
                    <p className="text-muted">{message}</p>
                </div>

                {children ? <div className="confirm-dialog-body">{children}</div> : null}

                <div className="confirm-dialog-actions">
                    <button type="button" className="btn confirm-dialog-cancel" onClick={onCancel} disabled={loading}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`btn ${tone === 'danger' ? 'confirm-dialog-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialog;
