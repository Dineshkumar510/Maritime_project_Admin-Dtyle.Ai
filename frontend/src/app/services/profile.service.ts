import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { BrandingService, BrandingProfile } from './branding.service';

interface ProfileResponse {
  success: boolean;
  profile: BrandingProfile;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly branding = inject(BrandingService);
  private readonly api = `${environment.expressApiUrl}/profile`;

  /** GET /api/profile/me */
  load(): Observable<BrandingProfile> {
    return this.http
      .get<ProfileResponse>(`${this.api}/me`, { withCredentials: true })
      .pipe(
        tap(r => this.branding.setProfile(r.profile)),
        // unwrap to the profile so callers don't deal with the envelope
        // (using map would do but we already have tap; use a second tap)
        catchError(err => throwError(() => err)),
      ) as unknown as Observable<BrandingProfile>;
  }

  /** PUT /api/profile  { display_name?, org_name? } */
  update(payload: { display_name?: string; org_name?: string }): Observable<BrandingProfile> {
    return this.http
      .put<ProfileResponse>(this.api, payload, { withCredentials: true })
      .pipe(
        tap(r => this.branding.setProfile(r.profile)),
        catchError(err => throwError(() => err)),
      ) as unknown as Observable<BrandingProfile>;
  }

  /** POST /api/profile/photo  (multipart, field "image") */
  uploadPhoto(file: File): Observable<BrandingProfile> {
    return this.uploadImage('/photo', file);
  }

  /** POST /api/profile/logo  (multipart, field "image") */
  uploadLogo(file: File): Observable<BrandingProfile> {
    return this.uploadImage('/logo', file);
  }

  /** DELETE /api/profile/photo */
  removePhoto(): Observable<BrandingProfile> {
    return this.http
      .delete<ProfileResponse>(`${this.api}/photo`, { withCredentials: true })
      .pipe(tap(r => this.branding.setProfile(r.profile))) as unknown as Observable<BrandingProfile>;
  }

  /** DELETE /api/profile/logo */
  removeLogo(): Observable<BrandingProfile> {
    return this.http
      .delete<ProfileResponse>(`${this.api}/logo`, { withCredentials: true })
      .pipe(tap(r => this.branding.setProfile(r.profile))) as unknown as Observable<BrandingProfile>;
  }

  // ── internal ───────────────────────────────────────────────────────────────

  private uploadImage(path: '/photo' | '/logo', file: File): Observable<BrandingProfile> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http
      .post<ProfileResponse>(`${this.api}${path}`, fd, { withCredentials: true })
      .pipe(
        tap(r => this.branding.setProfile(r.profile)),
        catchError(err => throwError(() => err)),
      ) as unknown as Observable<BrandingProfile>;
  }
}
