import React, { useState, useEffect } from 'react';
import { LogOut, PlusCircle, History, RefreshCcw, CloudOff } from 'lucide-react';
import OSForm from './components/OSForm';
import OSList from './components/OSList';
import Login from './components/Login';
import { getSession, login, logout } from './services/authService';
import { logProgress, logSystemStartup } from './services/progressLog';
import { getSyncState, syncPendingOperations } from './services/syncService';
import { subscribe, EVENTS } from './events/eventBus';

function App() {
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
            await syncPendingOperations();
            refreshSyncState();
            setSyncing(false);
        };

        const handleOffline = () => {
            setIsOnline(false);
            refreshSyncState();
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
        switch (activeTab) {
            case 'nova':
                return <OSForm onSuccess={() => setActiveTab('historico')} />;
            case 'historico': return <OSList />;
            default: return <OSForm />;
        }
    };

    const handleLogin = async (username, password) => {
        setLoginLoading(true);
        try {
            const user = await login(username, password);
            setCurrentUser(user);
            await logProgress('AUTH', `Login aprovado para ${user.name}`, 'CHECK');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        setCurrentUser(null);
        await logProgress('AUTH', 'Logout executado', 'ACT');
    };

    const handleSyncNow = async () => {
        setSyncing(true);
        await syncPendingOperations();
        setSyncState(getSyncState());
        setSyncing(false);
    };

    if (authLoading) {
        return (
            <main className="container">
                <div className="card">Validando sessao...</div>
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
                        <button
                            className={`tab-btn ${activeTab === 'nova' ? 'active' : ''}`}
                            onClick={() => setActiveTab('nova')}
                        >
                            <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                            Nova OS
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'historico' ? 'active' : ''}`}
                            onClick={() => setActiveTab('historico')}
                        >
                            <History size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                            Histórico
                        </button>
                    </div>
                    <div className="sync-chip">
                        {!isOnline && <CloudOff size={14} />}
                        <span>{isOnline ? `${syncState.pending || 0} pend.` : 'Offline'}</span>
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
                {renderContent()}
            </main>
        </div>
    );
}

export default App;
