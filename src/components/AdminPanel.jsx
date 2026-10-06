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
    Pencil,
    Power,
} from 'lucide-react';
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser } from '../services/adminService';
import { useToast } from './ui/ToastProvider';
import ConfirmDialog from './ui/ConfirmDialog';

const ROLE_OPTIONS = [
    { value: 'technician', label: 'Técnico' },
    { value: 'admin', label: 'Administrador' },
];

const PAGE_SIZE = 10;

function AdminPanel() {
    const toast = useToast();
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
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editTargetUser, setEditTargetUser] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', username: '', role: 'technician' });
    const [editError, setEditError] = useState('');
    const [page, setPage] = useState(1);
    const [deleteTargetUser, setDeleteTargetUser] = useState(null);

    const loadUsers = async (nextSearch = search) => {
        setLoading(true);
        setError('');
        try {
            const items = await fetchAdminUsers({ search: nextSearch });
            setUsers(items);
            setLastUpdatedAt(new Date());
        } catch (loadError) {
            setError(loadError.message || 'Falha ao carregar usuários');
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
            setCreateError('Senha inicial deve ter no mínimo 6 caracteres.');
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
            toast.success('Usuário criado com sucesso.', 'Painel administrativo');
        } catch (createRequestError) {
            setCreateError(createRequestError.message || 'Não foi possível criar usuário.');
        }
    };

    const handleUserUpdate = async (userId, payload) => {
        setSavingUserId(userId);
        try {
            await updateAdminUser(userId, payload);
            await loadUsers();
            toast.success('Usuário atualizado com sucesso.', 'Painel administrativo');
        } catch (updateError) {
            toast.error(updateError.message || 'Não foi possível atualizar usuário.', 'Painel administrativo');
        } finally {
            setSavingUserId('');
        }
    };

    const handleDeleteUser = async (user) => {
        setSavingUserId(user.id);
        try {
            await deleteAdminUser(user.id);
            await loadUsers();
            setPage(1);
            setDeleteTargetUser(null);
            toast.success('Usuário excluído com sucesso.', 'Painel administrativo');
        } catch (deleteError) {
            toast.error(deleteError.message || 'Não foi possível excluir usuário.', 'Painel administrativo');
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

    const openEditUser = (user) => {
        setEditTargetUser(user);
        setEditForm({ name: user.name, username: user.username, role: user.role });
        setEditError('');
        setEditModalOpen(true);
    };

    const submitUserEdit = async (event) => {
        event.preventDefault();
        setEditError('');

        const name = editForm.name.trim();
        const username = editForm.username.trim();
        if (name.length < 3 || username.length < 3) {
            setEditError('Nome e nome de usuário devem ter ao menos 3 caracteres.');
            return;
        }

        if (!editTargetUser) {
            setEditError('Usuário inválido para edição.');
            return;
        }

        setSavingUserId(editTargetUser.id);
        try {
            await updateAdminUser(editTargetUser.id, { name, username, role: editForm.role });
            setEditModalOpen(false);
            setEditTargetUser(null);
            await loadUsers();
            toast.success('Usuário atualizado com sucesso.', 'Painel administrativo');
        } catch (editRequestError) {
            setEditError(editRequestError.message || 'Não foi possível atualizar o usuário.');
        } finally {
            setSavingUserId('');
        }
    };

    const submitPasswordReset = async (event) => {
        event.preventDefault();
        setPasswordError('');

        if (newPassword.length < 6) {
            setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
            return;
        }

        if (!passwordTargetUser) {
            setPasswordError('Usuário inválido para redefinição de senha.');
            return;
        }

        setSavingUserId(passwordTargetUser.id);
        try {
            await updateAdminUser(passwordTargetUser.id, { password: newPassword });
            setPasswordModalOpen(false);
            setPasswordTargetUser(null);
            setNewPassword('');
            await loadUsers();
            toast.success('Senha redefinida com sucesso.', 'Painel administrativo');
        } catch (resetError) {
            setPasswordError(resetError.message || 'Não foi possível atualizar a senha.');
        } finally {
            setSavingUserId('');
        }
    };

    return (
        <div className="admin-dashboard-shell">
            <section className="admin-hero-card">
                <div>
                    <p className="admin-eyebrow">Painel de Controle</p>
                    <h2>Dashboard de Usuários</h2>
                    <p className="text-muted">Gestão de acessos internos e controle de perfis em um único painel.</p>
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
                        Novo usuário
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
                        <p>Total de usuários</p>
                        <h3>{stats.total}</h3>
                    </div>
                </article>
                <article className="admin-kpi-card">
                    <div className="admin-kpi-icon"><UserCheck size={18} /></div>
                    <div>
                        <p>Usuários ativos</p>
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
                        <p>Usuários inativos</p>
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
                            placeholder="Buscar por nome, usuário ou perfil"
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
                            Técnicos
                        </button>
                    </div>
                </div>

                <div className="admin-summary-bar">
                    <span className="text-muted">Exibindo {filteredUsers.length} usuário(s)</span>
                    <span className="text-muted">Última atualização: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('pt-BR') : '-'}</span>
                </div>

                {error && (
                    <div className="occurrence-box" style={{ marginBottom: '1rem' }}>
                        <label style={{ color: '#ef4444' }}>Erro</label>
                        <p>{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="app-state-card admin-inline-state">
                        <div className="app-state-spinner animate-spin" />
                        <div>
                            <h3>Atualizando painel de usuários</h3>
                            <p className="text-muted">Buscando perfis, status e permissões cadastradas.</p>
                        </div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="empty-state-card">
                        <strong>Nenhum usuário encontrado.</strong>
                        Ajuste os filtros ou crie um novo acesso para a equipe.
                    </div>
                ) : (
                    <div className="admin-table">
                        <div className="admin-table-head">
                            <span>Usuário</span>
                            <span>Perfil</span>
                            <span>Status</span>
                            <span>Ações</span>
                            <span>Criado em</span>
                        </div>

                        {paginatedUsers.map((user) => (
                            <div key={user.id} className="admin-table-row">
                                <div className="admin-cell">
                                    <span className="admin-cell-label">Usuário</span>
                                    <div className="admin-user-title-row">
                                        <div className="admin-user-avatar">
                                            {user.role === 'admin' ? <Shield size={16} /> : <UserCircle2 size={16} />}
                                        </div>
                                        <div>
                                            <h3>{user.name}</h3>
                                            <span className="text-muted">@{user.username}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="admin-cell">
                                    <span className="admin-cell-label">Perfil</span>
                                    <span className="admin-role-label">
                                        {user.role === 'admin' ? 'Administrador' : 'Técnico'}
                                    </span>
                                </div>

                                <div className="admin-cell">
                                    <span className="admin-cell-label">Status</span>
                                    <div className="admin-user-status-row">
                                        <span className={`admin-status-pill ${user.isActive ? 'is-active' : 'is-inactive'}`}>
                                            {user.isActive ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                </div>

                                <div className="admin-cell">
                                    <span className="admin-cell-label">Ações</span>
                                    <div className="admin-user-actions-row">
                                        <button
                                            type="button"
                                            className="btn admin-action-icon admin-action-edit"
                                            onClick={() => openEditUser(user)}
                                            disabled={savingUserId === user.id}
                                            title="Editar usuário"
                                            aria-label="Editar usuário"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn admin-action-icon admin-action-password"
                                            onClick={() => openResetPassword(user)}
                                            disabled={savingUserId === user.id}
                                            title="Alterar senha"
                                            aria-label="Alterar senha"
                                        >
                                            <KeyRound size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn admin-action-icon ${user.isActive ? 'admin-action-deactivate' : 'admin-action-activate'}`}
                                            onClick={() => handleUserUpdate(user.id, { isActive: !user.isActive })}
                                            disabled={savingUserId === user.id}
                                            title={user.isActive ? 'Desativar usuário' : 'Ativar usuário'}
                                            aria-label={user.isActive ? 'Desativar usuário' : 'Ativar usuário'}
                                        >
                                            <Power size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn admin-action-icon admin-action-delete"
                                            onClick={() => setDeleteTargetUser(user)}
                                            disabled={savingUserId === user.id}
                                            title="Excluir usuário"
                                            aria-label="Excluir usuário"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-cell">
                                    <span className="admin-cell-label">Criado em</span>
                                    <p className="text-muted">{new Date(user.createdAt).toLocaleString('pt-BR')}</p>
                                </div>
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
                        <span className="text-muted">Página {page} de {totalPages}</span>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={page >= totalPages}
                        >
                            Próxima
                        </button>
                    </div>
                )}
            </section>

            {createModalOpen && (
                <div className="modal-backdrop" role="presentation" onClick={() => setCreateModalOpen(false)}>
                    <div className="modal-card admin-modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Novo usuário</h2>
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
                                <label>Usuário</label>
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Senha temporária</label>
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
                                Criar usuário
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {editModalOpen && (
                <div className="modal-backdrop" role="presentation" onClick={() => setEditModalOpen(false)}>
                    <div className="modal-card admin-modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-user-title" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2 id="edit-user-title">Editar usuário</h2>
                            <button type="button" className="icon-btn" onClick={() => setEditModalOpen(false)} aria-label="Fechar modal" disabled={Boolean(savingUserId)}>
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={submitUserEdit}>
                            <div className="form-group">
                                <label>Nome</label>
                                <input type="text" value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} autoFocus required />
                            </div>
                            <div className="form-group">
                                <label>Nome de usuário</label>
                                <input type="text" value={editForm.username} onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label>Perfil</label>
                                <select value={editForm.role} onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}>
                                    {ROLE_OPTIONS.map((roleOption) => <option key={roleOption.value} value={roleOption.value}>{roleOption.label}</option>)}
                                </select>
                            </div>
                            {editError ? <p className="form-error">{editError}</p> : null}
                            <div className="modal-actions">
                                <button type="button" className="btn" onClick={() => setEditModalOpen(false)} disabled={Boolean(savingUserId)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={Boolean(savingUserId)}>{savingUserId ? 'Salvando...' : 'Salvar alterações'}</button>
                            </div>
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
                            Usuário: <strong>{passwordTargetUser?.name || '-'}</strong>
                        </p>

                        <form onSubmit={submitPasswordReset}>
                            <div className="form-group">
                                <label>Nova senha temporária</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    minLength={6}
                                    required
                                />
                            </div>
                            {passwordError && <p className="login-error">{passwordError}</p>}
                            <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '0.8rem' }}>
                                O usuário deverá definir uma nova senha no próximo acesso.
                            </p>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                                <KeyRound size={16} />
                                Salvar nova senha
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={Boolean(deleteTargetUser)}
                title="Excluir acesso deste usuário?"
                message="A conta sera removida do painel, mas o historico operacional permanece preservado."
                confirmLabel="Excluir usuário"
                cancelLabel="Manter usuário"
                loading={savingUserId === deleteTargetUser?.id}
                onCancel={() => setDeleteTargetUser(null)}
                onConfirm={() => deleteTargetUser && handleDeleteUser(deleteTargetUser)}
            >
                {deleteTargetUser ? (
                    <div className="confirm-dialog-user-card">
                        <strong>{deleteTargetUser.name}</strong>
                        <span>@{deleteTargetUser.username}</span>
                        <span>{deleteTargetUser.role === 'admin' ? 'Administrador' : 'Técnico'}</span>
                    </div>
                ) : null}
            </ConfirmDialog>
        </div>
    );
}

export default AdminPanel;
