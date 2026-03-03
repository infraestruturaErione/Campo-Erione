import React, { useEffect, useState } from 'react';
import { getOSList } from '../services/storage';
import { OSCard } from './OSCard';
import { subscribe, EVENTS } from '../events/eventBus';

function OSList() {
    const [osList, setOsList] = useState([]);

    useEffect(() => {
        const load = () => {
            const list = getOSList();
            setOsList([...list].reverse());
        };
        load();

        // Use Event Bus Subscription
        return subscribe(EVENTS.OS_UPDATED, load);
    }, []);

    return (
        <div>
            <h2 style={{ marginBottom: '1.5rem' }}>Histórico de Atendimentos</h2>
            {osList.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum relatório encontrado.
                </div>
            ) : (
                osList.map(os => (
                    <OSCard key={os.id} os={os} />
                ))
            )}
        </div>
    );
}

export default OSList;
