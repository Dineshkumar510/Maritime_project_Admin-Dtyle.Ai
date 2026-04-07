import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  user: AdminUser;
}

interface GenerateTokenResponse {
  success: boolean;
  ssoUrl: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AdminUser | null>(this._loadUser());
  private _token = signal<string | null>(this._loadToken());

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user() && !!this._token());
  readonly role = computed(() => this._user()?.role ?? null);

  private readonly apiUrl = environment.expressApiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  // ── FIX: Login → store token → navigate to /dashboard (no SSO redirect) ──
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${this.apiUrl}/login`,
        { username, password },
        { withCredentials: true },
      )
      .pipe(
        tap((res) => {
          if (res.success) {
            this._saveUser(res.user);
            this._saveToken(res.token);
            this.router.navigate(['/dashboard']); // ← goes to Angular dashboard
          }
        }),
        catchError((err) => throwError(() => err)),
      );
  }

  // ── FIX: NEW method — generates short-lived SSO token for a ship card click ──
  generateShipToken(shipId: number): Observable<GenerateTokenResponse> {
    return this.http
      .post<GenerateTokenResponse>(
        `${this.apiUrl}/generate-token`,
        { shipId },
        { withCredentials: true },
      )
      .pipe(catchError((err) => throwError(() => err)));
  }

  // ── Logout — only clears Angular session, does NOT touch Next.js ──────────
  logout(): void {
    this.http
      .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    this._clearSession();
    this.router.navigate(['/login']);
  }

  logoutAll(): void {
    this.http
      .post(`${this.apiUrl}/logout-all`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    this._clearSession();
    this.router.navigate(['/login']);
  }

  // ── Called by sso-logout route when Next.js redirects back ───────────────
  handleSSOLogout(): void {
    this._clearSession();
  }

  refreshToken(): Observable<{ success: boolean; token: string }> {
    return this.http
      .post<{
        success: boolean;
        token: string;
      }>(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          if (res.token) this._saveToken(res.token);
        }),
        catchError((err) => throwError(() => err)),
      );
  }

  getToken(): string | null {
    return this._token();
  }

  hasRole(...roles: string[]): boolean {
    const r = this.role();
    return !!r && roles.includes(r);
  }

  private _saveUser(user: AdminUser): void {
    sessionStorage.setItem('maritime_user', JSON.stringify(user));
    this._user.set(user);
  }

  private _saveToken(token: string): void {
    sessionStorage.setItem('maritime_token', token);
    this._token.set(token);
  }

  private _clearSession(): void {
    sessionStorage.removeItem('maritime_user');
    sessionStorage.removeItem('maritime_token');
    this._user.set(null);
    this._token.set(null);
  }

  private _loadUser(): AdminUser | null {
    try {
      return JSON.parse(sessionStorage.getItem('maritime_user') || 'null');
    } catch {
      return null;
    }
  }

  private _loadToken(): string | null {
    return sessionStorage.getItem('maritime_token');
  }
}
