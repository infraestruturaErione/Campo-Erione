import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL?.trim();
const useRemoteServer = Boolean(serverUrl);

const config: CapacitorConfig = {
    appId: 'com.erione.field',
    appName: 'Erione Field',
    webDir: 'dist',
    ...(useRemoteServer
        ? {
            server: {
                url: serverUrl,
                cleartext: serverUrl?.startsWith('http://') ?? false,
            },
        }
        : {}),
};

export default config;

