import React, { useEffect, useMemo, useState } from 'react';
import { getOSList } from '../services/storage';
import { OSCard } from './OSCard';
import { subscribe, EVENTS } from '../events/eventBus';
import { fetchAdminOS } from '../services/adminService';
import { useToast } from './ui/ToastProvider';
import { CalendarDays, X } from 'lucide-react';

const PAGE_SIZE = 10;

const toDateInputValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const openNativeDatePicker = (event) => {
    if (typeof event.currentTarget.showPicker === 'function') {
        event.currentTarget.showPicker();
    }
};

function OSList({ currentUser }) {
    const toast = useToast();
    const [osList, setOsList] = useState([]);
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;

        const load = async () => {
            if (currentUser?.role === 'admin') {
                setLoading(true);
                try {
                    const items = await fetchAdminOS();
                    if (active) {
                        setOsList(items);
                    }
                } catch (error) {
                    if (active) {
                        setOsList([]);
                        toast.error(error.message || 'Falha ao carregar historico sincronizado.', 'Historico admin');
                    }
                } finally {
                    if (active) {
                        setLoading(false);
                    }
                }
                return;
            }

            const list = getOSList();
            const visible = list.filter((item) => item.ownerUserId && item.ownerUserId === currentUser?.id);
            if (active) {
                setOsList([...visible].reverse());
            }
        };
        void load();

        const unsubscribe = subscribe(EVENTS.OS_UPDATED, () => {
            void load();
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, [currentUser, toast]);

    const filteredList = useMemo(() => {
        const term = search.trim().toLowerCase();
        return osList.filter((item) => {
            const itemDate = toDateInputValue(item.createdAt);
            if (startDate && (!itemDate || itemDate < startDate)) return false;
            if (endDate && (!itemDate || itemDate > endDate)) return false;
            if (!term) return true;

            const haystack = [
                item.obraEquipamento,
                item.responsavelContratada,
                item.responsavelMotiva,
                item.ownerName,
                item.ownerUsername,
                item.local,
                item.status,
                item.id,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(term);
        });
    }, [osList, search, startDate, endDate]);

    const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
    const historyStats = useMemo(() => {
        const withPhotos = filteredList.filter((item) => {
            const metaCount = Array.isArray(item.photosMeta) ? item.photosMeta.length : 0;
            const idCount = Array.isArray(item.photoIds) ? item.photoIds.length : 0;
            return metaCount + idCount > 0;
        }).length;
        const concluded = filteredList.filter((item) => item.status === 'Concluido').length;
        const activeObras = new Set(
            filteredList
                .map((item) => String(item.obraEquipamento || '').trim())
                .filter(Boolean)
        ).size;

        return {
            total: filteredList.length,
            withPhotos,
            concluded,
            activeObras,
        };
    }, [filteredList]);

    const currentPageItems = useMemo(() => {
        const normalizedPage = Math.min(page, totalPages);
        const start = (normalizedPage - 1) * PAGE_SIZE;
        return filteredList.slice(start, start + PAGE_SIZE);
    }, [filteredList, page, totalPages]);

    useEffect(() => {
        setPage(1);
    }, [search, startDate, endDate]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    return (
        <div>
            <div className="section-heading">
                <div>
                    <p className="section-eyebrow">Central de relatorios</p>
                    <h2>Historico de Atendimentos</h2>
                </div>
                <p className="text-muted">Consulte, exporte e acompanhe os registros tecnicos da operacao.</p>
            </div>

            <div className="history-toolbar">
                <input
                    type="text"
                    placeholder="Busca rapida por obra, responsavel, local, status ou OS..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                {currentUser?.role === 'admin' && (
                    <div className="history-date-filters">
                        <label>
                            <CalendarDays size={16} />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                                onClick={openNativeDatePicker}
                                onFocus={openNativeDatePicker}
                                aria-label="Data inicial"
                            />
                        </label>
                        <label>
                            <CalendarDays size={16} />
                            <input
                                type="date"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(event) => setEndDate(event.target.value)}
                                onClick={openNativeDatePicker}
                                onFocus={openNativeDatePicker}
                                aria-label="Data final"
                            />
                        </label>
                        {(startDate || endDate) && (
                            <button
                                type="button"
                                className="icon-btn history-clear-date"
                                onClick={() => {
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                aria-label="Limpar filtro de datas"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                )}
                <span className="text-muted">{filteredList.length} resultado(s)</span>
            </div>

            {currentUser?.role === 'admin' && (
                <section className="history-kpi-grid">
                    <article className="history-kpi-card">
                        <span>Total no periodo</span>
                        <strong>{historyStats.total}</strong>
                    </article>
                    <article className="history-kpi-card">
                        <span>Relatorios concluidos</span>
                        <strong>{historyStats.concluded}</strong>
                    </article>
                    <article className="history-kpi-card">
                        <span>Registros com foto</span>
                        <strong>{historyStats.withPhotos}</strong>
                    </article>
                    <article className="history-kpi-card">
                        <span>Obras ativas</span>
                        <strong>{historyStats.activeObras}</strong>
                    </article>
                </section>
            )}

            {loading ? (
                <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    Carregando historico sincronizado...
                </div>
            ) : filteredList.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum relatorio encontrado.
                </div>
            ) : (
                <>
                    {currentPageItems.map((os) => (
                        <OSCard
                            key={os.id}
                            os={os}
                            showCreator={currentUser?.role === 'admin'}
                        />
                    ))}

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
                </>
            )}
        </div>
    );
}

export default OSList;
