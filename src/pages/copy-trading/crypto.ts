// Lightweight AES-GCM encryption utilities for optional at-rest obfuscation
// Note: Since key is stored on the client, this is best-effort protection.

const KEY_STORAGE = 'copy_trading.key.v1';

const base64ToArrayBuffer = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
const arrayBufferToBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function getOrCreateKey(): Promise<CryptoKey> {
    const existing = localStorage.getItem(KEY_STORAGE);
    if (existing) {
        const raw = base64ToArrayBuffer(existing);
        return await crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const raw = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(KEY_STORAGE, arrayBufferToBase64(raw));
    return key;
}

export async function encryptText(plain: string): Promise<string> {
    try {
        const key = await getOrCreateKey();
        const enc = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
        const payload = new Uint8Array(iv.byteLength + cipher.byteLength);
        payload.set(iv, 0);
        payload.set(new Uint8Array(cipher), iv.byteLength);
        return arrayBufferToBase64(payload.buffer);
    } catch {
        return plain; // fallback to plain if crypto fails
    }
}

export async function decryptText(data: string): Promise<string> {
    try {
        const key = await getOrCreateKey();
        const buf = base64ToArrayBuffer(data);
        const iv = new Uint8Array(buf.slice(0, 12));
        const cipher = buf.slice(12);
        const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
        return new TextDecoder().decode(plainBuf);
    } catch {
        return data; // fallback to given data if crypto fails
    }
}
