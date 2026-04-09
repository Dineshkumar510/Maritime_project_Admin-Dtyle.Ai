import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class UrlCryptoService {
  private readonly key = environment.urlEncryptionKey;

  encrypt(url: string, name: string): string {
    const payload = JSON.stringify({ url, name });
    const cipher  = CryptoJS.AES.encrypt(payload, this.key).toString();
    // Make Base64 URL-safe
    return cipher.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '~');
  }

  decrypt(token: string): { url: string; name: string } | null {
    try {
      // Restore standard Base64
      const cipher  = token.replace(/-/g, '+').replace(/_/g, '/').replace(/~/g, '=');
      const bytes   = CryptoJS.AES.decrypt(cipher, this.key);
      const payload = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(payload) as { url: string; name: string };
    } catch {
      return null;
    }
  }
}
