import { openDB } from 'idb';

const DB_NAME = 'AppCampoDB';
const STORE_NAME = 'photos';

export const initDB = async () => {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
};

export const OS_STORAGE_KEY = 'appcampo_os';

const safeParse = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
};

export const getOSList = () => {
    const data = localStorage.getItem(OS_STORAGE_KEY);
    return safeParse(data, []);
};

export const saveOS = (os) => {
    const list = getOSList();
    const existingIndex = list.findIndex((item) => item.id === os.id);

    if (existingIndex >= 0) {
        list[existingIndex] = os;
    } else {
        list.push(os);
    }

    localStorage.setItem(OS_STORAGE_KEY, JSON.stringify(list));
    return os;
};

export const storePhoto = async (id, blob) => {
    const db = await initDB();
    await db.put(STORE_NAME, blob, id);
};

export const getPhoto = async (id) => {
    const db = await initDB();
    return db.get(STORE_NAME, id);
};

export const deletePhoto = async (id) => {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
};

export const deleteOS = (id) => {
    const list = getOSList();
    const newList = list.filter((item) => item.id !== id);
    localStorage.setItem(OS_STORAGE_KEY, JSON.stringify(newList));
};
