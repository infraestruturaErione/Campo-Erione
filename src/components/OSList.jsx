import React, { useEffect, useMemo, useState } from 'react';
import { getOSList } from '../services/storage';
import { OSCard } from './OSCard';
import { subscribe, EVENTS } from '../events/eventBus';

const PAGE_SIZE = 10;

function OSList({ currentUser }) {
    const [osList, setOsList] = useState([]);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const load = () => {
            const list = getOSList();
            const visible = currentUser?.role === 'admin'
                ? list
                : list.filter((item) => item.ownerUserId && item.ownerUserId === currentUser?.id);
            setOsList([...visible].reverse());
        };
        load();

        return subscribe(EVENTS.OS_UPDATED, load);
    }, [currentUser]);

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
            <h2 style={{ marginBottom: '1.5rem' }}>Historico de Atendimentos</h2>

            <div className="history-toolbar">
                <input
                    type="text"
                    placeholder="Busca rapida por obra, responsavel, local, status ou OS..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <span className="text-muted">{filteredList.length} resultado(s)</span>
            </div>

            {filteredList.length === 0 ? (
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
