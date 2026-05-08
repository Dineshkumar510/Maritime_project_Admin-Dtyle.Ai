import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { BrandingService } from './branding.service';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  // ── new branding fields (optional so older payloads still type-check) ──
  username?: string;
  profile_photo_url?: string | null;
  org_logo_url?: string | null;
  org_name?: string | null;
}

interface LoginResponse {
  success: boolean;
  token: string;
  user: AdminUser;
}

interface MeResponse {
  user: AdminUser;
}

interface GenerateTokenResponse {
  success: boolean;
  ssoUrl: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly branding = inject(BrandingService);

  private _user = signal<AdminUser | null>(this._loadUser());
  private _token = signal<string | null>(this._loadToken());

  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user() && !!this._token());
  readonly role = computed(() => this._user()?.role ?? null);

  private readonly apiUrl = environment.expressApiUrl;

  constructor() {
    // Hydrate BrandingService from cache immediately so the UI shows
    // the right logo/avatar even before /api/me responds.
    const cached = this._user();
    if (cached) this.branding.setProfile(cached as any);

    // If we believe we're logged in, ask the server for a fresh profile.
    // Failures are silent — the interceptor will trigger a real logout
    // on 401 if the token is actually dead.
    if (this.isLoggedIn()) {
      this.refreshMe().subscribe({ error: () => {} });
    }
  }

  // ── Login / logout ──────────────────────────────────────────────────────

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
            this.branding.setProfile(res.user as any);
            this.router.navigate(['/dashboard']);
          }
        }),
        catchError((err) => throwError(() => err)),
      );
  }

  generateShipToken(shipId: number): Observable<GenerateTokenResponse> {
    return this.http
      .post<GenerateTokenResponse>(
        `${this.apiUrl}/generate-token`,
        { shipId },
        { withCredentials: true },
      )
      .pipe(catchError((err) => throwError(() => err)));
  }

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

  handleSSOLogout(): void {
    this._clearSession();
  }

  // ── Token / profile refresh ─────────────────────────────────────────────

  refreshToken(): Observable<{ success: boolean; token: string }> {
    return this.http
      .post<{ success: boolean; token: string }>(
        `${this.apiUrl}/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((res) => { if (res.token) this._saveToken(res.token); }),
        catchError((err) => throwError(() => err)),
      );
  }

  /**
   * Fetch the current user from the server and push the profile fields
   * into BrandingService. Called on app boot from this service's
   * constructor and after a profile edit (so a hard refresh doesn't
   * matter).
   */
  refreshMe(): Observable<AdminUser> {
    return this.http
      .get<MeResponse>(`${this.apiUrl}/me`, { withCredentials: true })
      .pipe(
        tap((res) => {
          if (res.user) {
            this._saveUser(res.user);
            this.branding.setProfile(res.user as any);
          }
        }),
        // map(r => r.user)
        // not using map to avoid an extra import; cast in caller is fine
        catchError((err) => throwError(() => err)),
      ) as unknown as Observable<AdminUser>;
  }

  // ── Read accessors ──────────────────────────────────────────────────────

  getToken(): string | null { return this._token(); }
  hasRole(...roles: string[]): boolean {
    const r = this.role();
    return !!r && roles.includes(r);
  }

  // ── Storage plumbing ────────────────────────────────────────────────────

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
    this.branding.reset();
  }

  private _loadUser(): AdminUser | null {
    try {
      return JSON.parse(sessionStorage.getItem('maritime_user') || 'null');
    } catch { return null; }
  }

  private _loadToken(): string | null {
    return sessionStorage.getItem('maritime_token');
  }
}
