import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_ICONS = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
};

const TOAST_TIMEOUT_MS = 4200;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const removeToast = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback((variant, message, title = '') => {
        const id = crypto.randomUUID();
        setToasts((current) => [
            ...current,
            {
                id,
                variant,
                title,
                message,
            },
        ]);

        window.setTimeout(() => {
            removeToast(id);
        }, TOAST_TIMEOUT_MS);
    }, [removeToast]);

    const api = useMemo(() => ({
        success: (message, title = 'Concluido') => pushToast('success', message, title),
        error: (message, title = 'Erro') => pushToast('error', message, title),
        info: (message, title = 'Aviso') => pushToast('info', message, title),
    }), [pushToast]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div className="toast-stack" aria-live="polite" aria-atomic="true">
                {toasts.map((toast) => {
                    const Icon = TOAST_ICONS[toast.variant] || Info;
                    return (
                        <article key={toast.id} className={`toast-card toast-${toast.variant}`}>
                            <div className="toast-icon">
                                <Icon size={18} />
                            </div>
                            <div className="toast-copy">
                                <strong>{toast.title}</strong>
                                <p>{toast.message}</p>
                            </div>
                            <button
                                type="button"
                                className="icon-btn toast-close-btn"
                                onClick={() => removeToast(toast.id)}
                                aria-label="Fechar notificação"
                            >
                                <X size={14} />
                            </button>
                        </article>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast deve ser usado dentro de ToastProvider');
    }
    return context;
}
