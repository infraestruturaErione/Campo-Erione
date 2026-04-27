import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL?.trim();
const useRemoteServer = Boolean(serverUrl);
const defaultServerConfig = {
    androidScheme: 'http',
} as const;

const config: CapacitorConfig = {
    appId: 'com.erione.field',
    appName: 'Erione Field',
    webDir: 'dist',
    ...(useRemoteServer
        ? {
            server: {
                ...defaultServerConfig,
                url: serverUrl,
                cleartext: serverUrl?.startsWith('http://') ?? false,
            },
        }
        : {
            server: defaultServerConfig,
        }),
};

export default config;

