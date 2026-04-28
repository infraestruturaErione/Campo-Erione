import React, { useEffect, useMemo, useState } from 'react';
import { getOSList } from '../services/storage';
import { OSCard } from './OSCard';
import { subscribe, EVENTS } from '../events/eventBus';
import { fetchAdminOS } from '../services/adminService';
import { useToast } from './ui/ToastProvider';

const PAGE_SIZE = 10;

function OSList({ currentUser }) {
    const toast = useToast();
    const [osList, setOsList] = useState([]);
    const [search, setSearch] = useState('');
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
        if (!term) {
            return osList;
        }

        return osList.filter((item) => {
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
    }, [osList, search]);

    const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));

    const currentPageItems = useMemo(() => {
        const normalizedPage = Math.min(page, totalPages);
        const start = (normalizedPage - 1) * PAGE_SIZE;
        return filteredList.slice(start, start + PAGE_SIZE);
    }, [filteredList, page, totalPages]);

    useEffect(() => {
        setPage(1);
    }, [search]);

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
                <span className="text-muted">{filteredList.length} resultado(s)</span>
            </div>

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
