import React, { useState } from 'react';
import { Lock, User, LogIn } from 'lucide-react';

function Login({ onSubmit, loading }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        try {
            await onSubmit(username, password);
        } catch (submitError) {
            setError(submitError.message || 'Falha ao autenticar');
        }
    };

    return (
        <div className="login-shell">
            <div className="login-layout">
                <div className="login-card">
                    <img src="/logo-erione.png" alt="Erione" className="login-logo" />
                    <p className="text-muted">Acesso restrito para equipe autorizada.</p>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Usuario</label>
                            <div className="input-icon">
                                <User size={16} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Senha</label>
                            <div className="input-icon">
                                <Lock size={16} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        {error && <p className="login-error">{error}</p>}

                        <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                            <LogIn size={18} />
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>

                <footer className="app-footer app-footer-login">
                    <a href="/politica-de-privacidade.html" target="_blank" rel="noreferrer">
                        Politica de privacidade
                    </a>
                </footer>
            </div>
        </div>
    );
}

export default Login;
