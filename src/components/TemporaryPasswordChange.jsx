import React, { useState } from 'react';
import { KeyRound, LockKeyhole, LogOut } from 'lucide-react';

function TemporaryPasswordChange({ loading, onSubmit, onLogout }) {
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('A nova senha deve ter no mínimo 6 caracteres.');
            return;
        }

        if (password !== passwordConfirmation) {
            setError('A confirmação da senha não confere.');
            return;
        }

        try {
            await onSubmit(password, passwordConfirmation);
        } catch (submitError) {
            setError(submitError.message || 'Não foi possível atualizar a senha.');
        }
    };

    return (
        <div className="login-shell">
            <div className="login-layout">
                <div className="login-card temporary-password-card">
                    <img src="/logo-erione.png" alt="Erione" className="login-logo" />
                    <div className="temporary-password-heading">
                        <LockKeyhole size={20} />
                        <div>
                            <h1>Definir nova senha</h1>
                            <p className="login-subtitle">Sua senha atual é temporária e precisa ser alterada antes de continuar.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Nova senha</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                minLength={6}
                                autoComplete="new-password"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirmar nova senha</label>
                            <input
                                type="password"
                                value={passwordConfirmation}
                                onChange={(event) => setPasswordConfirmation(event.target.value)}
                                minLength={6}
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        {error && <p className="login-error">{error}</p>}

                        <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                            <KeyRound size={18} />
                            {loading ? 'Salvando...' : 'Salvar nova senha'}
                        </button>
                    </form>

                    <button type="button" className="btn login-secondary-btn" onClick={onLogout} disabled={loading}>
                        <LogOut size={16} />
                        Sair
                    </button>
                </div>
            </div>
        </div>
    );
}

export default TemporaryPasswordChange;
