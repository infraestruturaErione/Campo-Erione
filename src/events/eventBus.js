/**
 * Event Bus for decoupled communication between Service Layer and UI.
 * Prevents direct DOM/Window dependencies in business logic.
 */

export const EVENTS = {
    OS_UPDATED: 'os-updated',
    OS_CREATED: 'os-created',
    PHOTO_SAVED: 'photo-saved'
};

export const emitOSUpdated = () => {
    window.dispatchEvent(new CustomEvent(EVENTS.OS_UPDATED));
};

export const emitOSCreated = (osData) => {
    window.dispatchEvent(new CustomEvent(EVENTS.OS_CREATED, { detail: osData }));
};

export const subscribe = (eventName, callback) => {
    const handler = (event) => callback(event.detail);
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
};
