import React, { useEffect, useMemo, useState } from 'react';
import {
    RefreshCcw,
    UserPlus,
    X,
    KeyRound,
    Trash2,
    Shield,
    UserCircle2,
    Users,
    UserCheck,
    UserX,
} from 'lucide-react';
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser } from '../services/adminService';

const ROLE_OPTIONS = [
    { value: 'technician', label: 'Tecnico' },
    { value: 'admin', label: 'Administrador' },
];

const PAGE_SIZE = 10;

function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [savingUserId, setSavingUserId] = useState('');
    const [error, setError] = useState('');
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createError, setCreateError] = useState('');
    const [form, setForm] = useState({
        name: '',
        username: '',
        password: '',
        role: 'technician',
    });

    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [passwordTargetUser, setPasswordTargetUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [page, setPage] = useState(1);

    const loadUsers = async (nextSearch = search) => {
        setLoading(true);
        setError('');
        try {
            const items = await fetchAdminUsers({ search: nextSearch });
            setUsers(items);
            setLastUpdatedAt(new Date());
        } catch (loadError) {
            setError(loadError.message || 'Falha ao carregar usuarios');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers('');
    }, []);

    const filteredUsers = useMemo(() => {
        if (roleFilter === 'all') return users;
        return users.filter((item) => item.role === roleFilter);
    }, [users, roleFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const paginatedUsers = useMemo(() => {
        const normalizedPage = Math.min(page, totalPages);
        const start = (normalizedPage - 1) * PAGE_SIZE;
        return filteredUsers.slice(start, start + PAGE_SIZE);
    }, [filteredUsers, page, totalPages]);

    const stats = useMemo(() => {
        const total = users.length;
        const active = users.filter((item) => item.isActive).length;
        const inactive = total - active;
        const admins = users.filter((item) => item.role === 'admin').length;
        return { total, active, inactive, admins };
    }, [users]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const handleCreateUser = async (event) => {
        event.preventDefault();
        setCreateError('');

        if (String(form.password || '').length < 6) {
            setCreateError('Senha inicial deve ter no minimo 6 caracteres.');
            return;
        }

        try {
            await createAdminUser({
                name: form.name.trim(),
                username: form.username.trim(),
                password: form.password,
                role: form.role,
            });
            setForm({ name: '', username: '', password: '', role: 'technician' });
            setCreateModalOpen(false);
            await loadUsers();
            setPage(1);
        } catch (createRequestError) {
            setCreateError(createRequestError.message || 'Nao foi possivel criar usuario');
        }
    };

    const handleUserUpdate = async (userId, payload) => {
        setSavingUserId(userId);
        try {
            await updateAdminUser(userId, payload);
            await loadUsers();
        } catch (updateError) {
            alert(updateError.message || 'Nao foi possivel atualizar usuario');
        } finally {
            setSavingUserId('');
        }
    };

    const handleDeleteUser = async (user) => {
        const shouldDelete = window.confirm(
            `Excluir usuario ${user.name} (@${user.username})?\n\nO historico de OS sera mantido no painel admin.`
        );

        if (!shouldDelete) return;

        setSavingUserId(user.id);
        try {
            await deleteAdminUser(user.id);
            await loadUsers();
            setPage(1);
        } catch (deleteError) {
            alert(deleteError.message || 'Nao foi possivel excluir usuario');
        } finally {
            setSavingUserId('');
        }
    };

    const openResetPassword = (user) => {
        setPasswordTargetUser(user);
        setNewPassword('');
        setPasswordError('');
        setPasswordModalOpen(true);
    };

    const submitPasswordReset = async (event) => {
        event.preventDefault();
        setPasswordError('');

        if (newPassword.length < 6) {
            setPasswordError('A nova senha deve ter no minimo 6 caracteres.');
            return;
        }

        if (!passwordTargetUser) {
            setPasswordError('Usuario invalido para reset de senha.');
            return;
        }

        setSavingUserId(passwordTargetUser.id);
        try {
            await updateAdminUser(passwordTargetUser.id, { password: newPassword });
            setPasswordModalOpen(false);
            setPasswordTargetUser(null);
            setNewPassword('');
            await loadUsers();
        } catch (resetError) {
            setPasswordError(resetError.message || 'Nao foi possivel atualizar a senha');
        } finally {
            setSavingUserId('');
        }
    };

    return (
        <div className="admin-dashboard-shell">
            <section className="admin-hero-card">
                <div>
                    <p className="admin-eyebrow">Painel de Controle</p>
                    <h2>Dashboard de Usuarios</h2>
                    <p className="text-muted">Governanca de acessos, seguranca operacional e visibilidade executiva em tempo real.</p>
                </div>
                <div className="admin-hero-actions">
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            setCreateError('');
                            setCreateModalOpen(true);
                        }}
                    >
                        <UserPlus size={16} />
                        Novo usuario
                    </button>
                    <button className="btn" style={{ background: '#334155', color: '#fff' }} onClick={() => loadUsers()} disabled={loading}>
                        <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>
            </section>

            <section className="admin-kpi-grid">
                <article className="admin-kpi-card">
                    <div className="admin-kpi-icon"><Users size={18} /></div>
                    <div>
                        <p>Total de usuarios</p>
                        <h3>{stats.total}</h3>
                    </div>
                </article>
                <article className="admin-kpi-card">
                    <div className="admin-kpi-icon"><UserCheck size={18} /></div>
                    <div>
                        <p>Usuarios ativos</p>
                        <h3>{stats.active}</h3>
                    </div>
                </article>
                <article className="admin-kpi-card">
                    <div className="admin-kpi-icon"><Shield size={18} /></div>
                    <div>
                        <p>Administradores</p>
                        <h3>{stats.admins}</h3>
                    </div>
                </article>
                <article className="admin-kpi-card">
                    <div className="admin-kpi-icon"><UserX size={18} /></div>
                    <div>
                        <p>Usuarios inativos</p>
                        <h3>{stats.inactive}</h3>
                    </div>
                </article>
            </section>

            <section className="card admin-panel-core">
                <div className="admin-toolbar">
                    <form
                        className="admin-search-row"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setPage(1);
                            loadUsers(search);
                        }}
                    >
                        <input
                            type="text"
                            placeholder="Buscar por nome, usuario ou perfil"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        <button type="submit" className="btn">Buscar</button>
                    </form>
                    <div className="admin-filter-chip-row">
                        <button
                            type="button"
                            className={`admin-chip ${roleFilter === 'all' ? 'active' : ''}`}
                            onClick={() => {
                                setRoleFilter('all');
                                setPage(1);
                            }}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            className={`admin-chip ${roleFilter === 'admin' ? 'active' : ''}`}
                            onClick={() => {
                                setRoleFilter('admin');
                                setPage(1);
                            }}
                        >
                            Admins
                        </button>
                        <button
                            type="button"
                            className={`admin-chip ${roleFilter === 'technician' ? 'active' : ''}`}
                            onClick={() => {
                                setRoleFilter('technician');
                                setPage(1);
                            }}
                        >
                            Tecnicos
                        </button>
                    </div>
                </div>

                <div className="admin-summary-bar">
                    <span className="text-muted">Exibindo {filteredUsers.length} usuario(s)</span>
                    <span className="text-muted">Ultima atualizacao: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('pt-BR') : '-'}</span>
                </div>

                {error && (
                    <div className="occurrence-box" style={{ marginBottom: '1rem' }}>
                        <label style={{ color: '#ef4444' }}>Erro</label>
                        <p>{error}</p>
                    </div>
                )}

                {loading ? (
                    <p className="text-muted">Carregando usuarios...</p>
                ) : filteredUsers.length === 0 ? (
                    <div className="card" style={{ margin: 0 }}>
                        Nenhum usuario cadastrado.
                    </div>
                ) : (
                    <div className="admin-table">
                        <div className="admin-table-head">
                            <span>Usuario</span>
                            <span>Perfil</span>
                            <span>Status</span>
                            <span>Acoes</span>
                            <span>Criado em</span>
                        </div>

                        {paginatedUsers.map((user) => (
                            <div key={user.id} className="admin-table-row">
                                <div className="admin-user-title-row">
                                    <div className="admin-user-avatar">
                                        {user.role === 'admin' ? <Shield size={16} /> : <UserCircle2 size={16} />}
                                    </div>
                                    <div>
                                        <h3>{user.name}</h3>
                                        <span className="text-muted">@{user.username}</span>
                                    </div>
                                </div>

                                <div>
                                    <select
                                        value={user.role}
                                        onChange={(event) => handleUserUpdate(user.id, { role: event.target.value })}
                                        disabled={savingUserId === user.id}
                                    >
                                        {ROLE_OPTIONS.map((roleOption) => (
                                            <option key={roleOption.value} value={roleOption.value}>{roleOption.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="admin-user-status-row">
                                    <span className={`badge ${user.isActive ? 'badge-done' : 'badge-pending'}`}>
                                        {user.isActive ? 'Ativo' : 'Inativo'}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => handleUserUpdate(user.id, { isActive: !user.isActive })}
                                        disabled={savingUserId === user.id}
                                        style={{ background: user.isActive ? '#7f1d1d' : '#14532d', color: '#fff', padding: '0.45rem 0.75rem' }}
                                    >
                                        {user.isActive ? 'Desativar' : 'Ativar'}
                                    </button>
                                </div>

                                <div className="admin-user-actions-row">
                                    <button
                                        type="button"
                                        className="btn"
                                        style={{ background: '#075985', color: '#fff', padding: '0.45rem 0.75rem' }}
                                        onClick={() => openResetPassword(user)}
                                        disabled={savingUserId === user.id}
                                    >
                                        <KeyRound size={16} />
                                        Senha
                                    </button>
                                    <button
                                        type="button"
                                        className="btn"
                                        style={{ background: '#991b1b', color: '#fff', padding: '0.45rem 0.75rem' }}
                                        onClick={() => handleDeleteUser(user)}
                                        disabled={savingUserId === user.id}
                                    >
                                        <Trash2 size={16} />
                                        Excluir
                                    </button>
                                </div>

                                <p className="text-muted">{new Date(user.createdAt).toLocaleString('pt-BR')}</p>
                            </div>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="history-pagination">
                        <button
                            type="button"
                            className="btn"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1}
                        >
                            Anterior
                        </button>
                        <span className="text-muted">Pagina {page} de {totalPages}</span>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={page >= totalPages}
                        >
                            Proxima
                        </button>
                    </div>
                )}
            </section>

            {createModalOpen && (
                <div className="modal-backdrop" role="presentation" onClick={() => setCreateModalOpen(false)}>
                    <div className="modal-card admin-modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Novo usuario</h2>
                            <button type="button" className="icon-btn" onClick={() => setCreateModalOpen(false)} aria-label="Fechar modal">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser}>
                            <div className="form-group">
                                <label>Nome</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Usuario</label>
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Senha inicial</label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Perfil</label>
                                <select
                                    value={form.role}
                                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                                >
                                    {ROLE_OPTIONS.map((roleOption) => (
                                        <option key={roleOption.value} value={roleOption.value}>{roleOption.label}</option>
                                    ))}
                                </select>
                            </div>
                            {createError && <p className="login-error">{createError}</p>}
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                <UserPlus size={16} />
                                Criar usuario
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {passwordModalOpen && (
                <div className="modal-backdrop" role="presentation" onClick={() => setPasswordModalOpen(false)}>
                    <div className="modal-card admin-modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Atualizar senha</h2>
                            <button type="button" className="icon-btn" onClick={() => setPasswordModalOpen(false)} aria-label="Fechar modal">
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-muted" style={{ marginBottom: '0.8rem' }}>
                            Usuario: <strong>{passwordTargetUser?.name || '-'}</strong>
                        </p>

                        <form onSubmit={submitPasswordReset}>
                            <div className="form-group">
                                <label>Nova senha</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    minLength={6}
                                    required
                                />
                            </div>
                            {passwordError && <p className="login-error">{passwordError}</p>}
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                <KeyRound size={16} />
                                Salvar nova senha
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel;
