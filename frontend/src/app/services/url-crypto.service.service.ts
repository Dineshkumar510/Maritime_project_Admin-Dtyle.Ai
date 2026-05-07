import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UrlCryptoService {
  private readonly key = environment.urlEncryptionKey;

  encryptShipRef(shipId: number, name: string): string {
    const payload = JSON.stringify({ shipId, name, kind: 'ship' });
    const cipher  = CryptoJS.AES.encrypt(payload, this.key).toString();
    return cipher.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '~');
  }

  decryptShipRef(token: string): { shipId: number; name: string } | null {
    try {
      const cipher  = token.replace(/-/g, '+').replace(/_/g, '/').replace(/~/g, '=');
      const bytes   = CryptoJS.AES.decrypt(cipher, this.key);
      const payload = bytes.toString(CryptoJS.enc.Utf8);
      const obj     = JSON.parse(payload);
      if (obj && typeof obj.shipId === 'number' && typeof obj.name === 'string') {
        return { shipId: obj.shipId, name: obj.name };
      }
      return null;
    } catch {
      return null;
    }
  }

  encrypt(url: string, name: string): string {
    const payload = JSON.stringify({ url, name });
    const cipher  = CryptoJS.AES.encrypt(payload, this.key).toString();
    return cipher.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '~');
  }

  decrypt(token: string): { url: string; name: string } | null {
    try {
      const cipher  = token.replace(/-/g, '+').replace(/_/g, '/').replace(/~/g, '=');
      const bytes   = CryptoJS.AES.decrypt(cipher, this.key);
      const payload = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(payload) as { url: string; name: string };
    } catch {
      return null;
    }
  }

  encryptRaw(text: string): string {
    if (!text) return '';
    const cipher = CryptoJS.AES.encrypt(text, this.key).toString();
    return cipher.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '~');
  }
}
