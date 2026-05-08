import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { BrandingService, BrandingProfile } from './branding.service';
import { AuthService } from './auth.service';

interface ProfileResponse {
  success: boolean;
  profile: BrandingProfile;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http    = inject(HttpClient);
  private readonly branding = inject(BrandingService);
  private readonly auth    = inject(AuthService);
  private readonly api     = `${environment.expressApiUrl}/profile`;

  load(): Observable<BrandingProfile> {
    return this.http
      .get<ProfileResponse>(`${this.api}/me`, { withCredentials: true })
      .pipe(
        tap(r => this._applyProfile(r.profile)),
        catchError(err => throwError(() => err)),
      ) as unknown as Observable<BrandingProfile>;
  }

  update(payload: { display_name?: string; org_name?: string }): Observable<BrandingProfile> {
    return this.http
      .put<ProfileResponse>(this.api, payload, { withCredentials: true })
      .pipe(
        tap(r => this._applyProfile(r.profile)),
        catchError(err => throwError(() => err)),
      ) as unknown as Observable<BrandingProfile>;
  }

  uploadPhoto(file: File): Observable<BrandingProfile> {
    return this.uploadImage('/photo', file);
  }

  uploadLogo(file: File): Observable<BrandingProfile> {
    return this.uploadImage('/logo', file);
  }

  removePhoto(): Observable<BrandingProfile> {
    return this.http
      .delete<ProfileResponse>(`${this.api}/photo`, { withCredentials: true })
      .pipe(tap(r => this._applyProfile(r.profile))) as unknown as Observable<BrandingProfile>;
  }

  removeLogo(): Observable<BrandingProfile> {
    return this.http
      .delete<ProfileResponse>(`${this.api}/logo`, { withCredentials: true })
      .pipe(tap(r => this._applyProfile(r.profile))) as unknown as Observable<BrandingProfile>;
  }


  private uploadImage(path: '/photo' | '/logo', file: File): Observable<BrandingProfile> {
    const fd = new FormData();
    fd.append('image', file);
    return this.http
      .post<ProfileResponse>(`${this.api}${path}`, fd, { withCredentials: true })
      .pipe(
        tap(r => this._applyProfile(r.profile)),
        catchError(err => throwError(() => err)),
      ) as unknown as Observable<BrandingProfile>;
  }

  private _applyProfile(profile: BrandingProfile): void {
    this.branding.setProfile(profile);
    this.auth.mergeBrandingIntoUser(profile);
  }
}
