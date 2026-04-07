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
  ssoUrl: string;
  token: string;
  user: AdminUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _user = signal<AdminUser | null>(this._loadUser());
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly role = computed(() => this._user()?.role ?? null);

  private readonly apiUrl = environment.expressApiUrl;
  private readonly nextUrl = environment.nextAppUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

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
            window.location.href = res.ssoUrl;
          }
        }),
        catchError((err) => throwError(() => err)),
      );
  }

  logout(): void {
    this.http
      .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });

    this._clearUser();
    this.router.navigate(['/login']);
  }

  logoutAll(): void {
    this.http
      .post(`${this.apiUrl}/logout-all`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });

    this._clearUser();
    this.router.navigate(['/login']);
  }

  handleSSOLogout(): void {
    this._clearUser();
  }

  refreshToken(): Observable<{ success: boolean; token: string }> {
    return this.http.post<any>(
      `${this.apiUrl}/refresh`,
      {},
      { withCredentials: true },
    );
  }

  hasRole(...roles: string[]): boolean {
    const r = this.role();
    return !!r && roles.includes(r);
  }

  private _saveUser(user: AdminUser): void {
    sessionStorage.setItem('maritime_user', JSON.stringify(user));
    this._user.set(user);
  }

  private _clearUser(): void {
    sessionStorage.removeItem('maritime_user');
    this._user.set(null);
  }

  private _loadUser(): AdminUser | null {
    try {
      const raw = sessionStorage.getItem('maritime_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
