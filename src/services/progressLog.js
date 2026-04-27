const LOG_API = '/api/log';
const SESSION_BOOT_KEY = 'appcampo_boot_logged_v1';
let loopCycle = 0;
const isDev = Boolean(import.meta.env.DEV);

const padCycle = (value) => String(value).padStart(4, '0');

const buildRalphLine = (action, details, phase = 'ACT') => {
    loopCycle += 1;
    const timestamp = new Date().toLocaleString('pt-BR');
    return `[${timestamp}] RALPH_LOOP | cycle=${padCycle(loopCycle)} | phase=${phase} | action=${action.toUpperCase()} | details=${details}`;
};

export const logProgress = async (action, details, phase = 'ACT') => {
    if (!isDev) {
        return;
    }

    const logLine = buildRalphLine(action, details, phase);

    try {
        await fetch(LOG_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log: logLine }),
        });
    } catch (error) {
        console.warn('Could not write to progress.txt, only logging to console.', error);
        console.log(logLine);
    }
};

export const logSystemStartup = async () => {
    if (typeof window === 'undefined') {
        return;
    }

    if (sessionStorage.getItem(SESSION_BOOT_KEY)) {
        return;
    }

    sessionStorage.setItem(SESSION_BOOT_KEY, '1');
    await logProgress('SISTEMA', 'Erione Field inicializado', 'BOOT');
};

export const getProgress = async () => {
    if (!isDev) {
        return '';
    }

    try {
        const response = await fetch(LOG_API);
        if (response.ok) {
            return await response.text();
        }
    } catch (error) {
        console.warn('Could not read progress.txt');
    }
    return '';
};

