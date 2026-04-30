import React, { useState, useEffect } from 'react';
import { LogOut, PlusCircle, History, RefreshCcw, CloudOff, Shield, Cloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import OSForm from './components/OSForm';
import OSList from './components/OSList';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import { getSession, login, logout } from './services/authService';
import { logProgress, logSystemStartup } from './services/progressLog';
import { getSyncState, syncPendingOperations } from './services/syncService';
import { subscribe, EVENTS } from './events/eventBus';
import { useToast } from './components/ui/ToastProvider';

function App() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('nova');
    const [currentUser, setCurrentUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginLoading, setLoginLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncState, setSyncState] = useState(getSyncState());
    const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

    useEffect(() => {
        logSystemStartup();
    }, []);

    useEffect(() => {
        const restoreSession = async () => {
            const user = await getSession();
            setCurrentUser(user);
            if (user?.role === 'admin') {
                setActiveTab('admin');
            }
            setAuthLoading(false);
        };

        restoreSession();
    }, []);

    useEffect(() => {
        const refreshSyncState = () => setSyncState(getSyncState());
        const unsub = subscribe(EVENTS.OS_UPDATED, refreshSyncState);

        const handleOnline = async () => {
            setIsOnline(true);
            setSyncing(true);
            const result = await syncPendingOperations();
            refreshSyncState();
            setSyncing(false);
            if (result.lastResult === 'success') {
                toast.success('Conexao restabelecida e fila sincronizada.', 'Online');
            } else if (result.lastResult === 'partial') {
                toast.info(result.message || 'A conexao voltou, mas alguns registros seguem pendentes.', 'Online');
            } else if (result.lastResult === 'error') {
                toast.error(result.message || 'A conexao voltou, mas a fila ainda precisa de atencao.', 'Online');
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            refreshSyncState();
            toast.info('O app entrou em modo offline. Novos registros serao guardados localmente.', 'Modo offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        refreshSyncState();
        return () => {
            unsub();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const renderContent = () => {
        if (currentUser?.role === 'admin') {
            if (activeTab === 'historico') {
                return <OSList currentUser={currentUser} />;
            }
            return <AdminPanel />;
        }

        switch (activeTab) {
            case 'nova':
                return <OSForm onSuccess={() => setActiveTab('historico')} currentUser={currentUser} />;
            case 'historico':
                return <OSList currentUser={currentUser} />;
            default:
                return <OSForm currentUser={currentUser} />;
        }
    };

    const handleLogin = async (username, password) => {
        setLoginLoading(true);
        try {
            const user = await login(username, password);
            setCurrentUser(user);
            setActiveTab(user?.role === 'admin' ? 'admin' : 'nova');
            await logProgress('AUTH', `Login aprovado para ${user.name}`, 'CHECK');
            toast.success(`Bem-vindo, ${user?.name || user?.username || 'equipe'}.`, 'Acesso liberado');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        setCurrentUser(null);
        setActiveTab('nova');
        await logProgress('AUTH', 'Logout executado', 'ACT');
        toast.info('Sessao encerrada com seguranca.', 'Saida concluida');
    };

    const handleSyncNow = async () => {
        setSyncing(true);
        await syncPendingOperations();
        const nextState = getSyncState();
        setSyncState(nextState);
        setSyncing(false);
        if (nextState.lastResult === 'success') {
            toast.success('Fila sincronizada com sucesso.', 'Sincronizacao');
        } else if (nextState.lastResult === 'partial') {
            toast.info(nextState.message || 'Parte da fila foi enviada, mas alguns registros seguem pendentes.', 'Sincronizacao');
        } else if (nextState.lastResult === 'error') {
            toast.error(nextState.message || 'Falha ao sincronizar a fila offline.', 'Sincronizacao');
        } else if (nextState.lastResult === 'offline') {
            toast.info('Sem internet para sincronizar agora.', 'Sincronizacao');
        }
    };

    const syncToneClass = !isOnline
        ? 'is-offline'
        : syncState.lastResult === 'error' || syncState.lastResult === 'partial'
            ? 'is-warning'
            : syncState.pending > 0 || syncing
                ? 'is-pending'
                : 'is-success';

    const syncMessage = !isOnline
        ? 'Modo offline ativo. Seus registros continuam seguros no dispositivo.'
        : syncing
            ? 'Sincronizando dados com o servidor...'
            : syncState.lastResult === 'error' || syncState.lastResult === 'partial'
                ? (syncState.message || 'Falha recente na sincronizacao. Tente novamente.')
                : syncState.pending > 0
                    ? `${syncState.pending} item(ns) aguardando envio para a nuvem.`
                    : `Tudo em dia. Ultima sincronizacao ${syncState.lastSyncAt ? new Date(syncState.lastSyncAt).toLocaleTimeString('pt-BR') : 'nao registrada'}.`;

    const SyncStatusIcon = !isOnline
        ? CloudOff
        : syncState.lastResult === 'error' || syncState.lastResult === 'partial'
            ? AlertTriangle
            : syncState.pending > 0 || syncing
                ? RefreshCcw
                : CheckCircle2;

    if (authLoading) {
        return (
            <main className="container">
                <div className="card app-state-card">
                    <div className="app-state-spinner animate-spin" />
                    <div>
                        <h2>Preparando ambiente Erione Field</h2>
                        <p className="text-muted">Validando sessao e restaurando os dados locais.</p>
                    </div>
                </div>
            </main>
        );
    }

    if (!currentUser) {
        return <Login onSubmit={handleLogin} loading={loginLoading} />;
    }

    return (
        <div className="App">
            <header>
                <div className="nav-container">
                    <div className="logo">
                        <img src="/logo-erione.png" alt="Erione" className="logo-image" />
                    </div>
                    <div className="tabs">
                        {currentUser?.role !== 'admin' && (
                            <button
                                className={`tab-btn ${activeTab === 'nova' ? 'active' : ''}`}
                                onClick={() => setActiveTab('nova')}
                            >
                                <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                Nova OS
                            </button>
                        )}

                        <button
                            className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`}
                            onClick={() => setActiveTab('historico')}
                        >
                            <History size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                            Historico
                        </button>

                        {currentUser?.role === 'admin' && (
                            <button
                                className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
                                onClick={() => setActiveTab('admin')}
                            >
                                <Shield size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                Usuarios
                            </button>
                        )}
                    </div>
                    <div className="sync-chip">
                        {!isOnline ? <CloudOff size={14} /> : <Cloud size={14} />}
                        <span>
                            {isOnline
                                ? `${syncState.pending || 0} pend.${syncState.failed ? ` | ${syncState.failed} erro` : ''}`
                                : 'Offline'}
                        </span>
                        <button className="sync-btn" onClick={handleSyncNow} disabled={syncing || !isOnline}>
                            <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} />
                            Sync
                        </button>
                    </div>
                    <button className="btn" style={{ background: '#334155', color: '#fff' }} onClick={handleLogout}>
                        <LogOut size={16} />
                        Sair
                    </button>
                </div>
            </header>

            <main className="container">
                <section className={`status-banner ${syncToneClass}`}>
                    <div className="status-banner-icon">
                        <SyncStatusIcon size={18} className={syncing ? 'animate-spin' : ''} />
                    </div>
                    <div className="status-banner-copy">
                        <strong>
                            {!isOnline
                                ? 'Modo offline'
                                : syncing
                                    ? 'Sincronizando'
                                    : syncState.lastResult === 'partial'
                                        ? 'Sincronizacao parcial'
                                        : syncState.lastResult === 'error'
                                            ? 'Atencao na fila'
                                            : 'Central de operacao'}
                        </strong>
                        <p>{syncMessage}</p>
                    </div>
                    <button className="btn status-banner-btn" onClick={handleSyncNow} disabled={syncing || !isOnline}>
                        <RefreshCcw size={16} className={syncing ? 'animate-spin' : ''} />
                        Atualizar agora
                    </button>
                </section>
                {renderContent()}
            </main>
        </div>
    );
}

export default App;
