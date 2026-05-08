import { Injectable, signal, computed } from '@angular/core';

export interface BrandingProfile {
  id: number;
  username?: string;
  name: string;
  email: string;
  role?: string;
  profile_photo_url?: string | null;
  org_logo_url?: string | null;
  org_name?: string | null;
}
const CACHE_KEY = 'maritime_branding';

@Injectable({ providedIn: 'root' })
export class BrandingService {
  readonly DEFAULT_LOGO = 'assets/D-logo.png';
  readonly DEFAULT_BRAND_NAME = 'Dtyle.AI';

  private _name             = signal<string>('');
  private _email            = signal<string>('');
  private _profilePhotoUrl  = signal<string | null>(null);
  private _orgLogoUrl       = signal<string | null>(null);
  private _orgName          = signal<string | null>(null);

  readonly name             = this._name.asReadonly();
  readonly email            = this._email.asReadonly();
  readonly profilePhotoUrl  = this._profilePhotoUrl.asReadonly();
  readonly orgLogoUrl       = this._orgLogoUrl.asReadonly();
  readonly orgName          = this._orgName.asReadonly();

  readonly brandLogo = computed(() => this._orgLogoUrl() || this.DEFAULT_LOGO);
  readonly brandName = computed(() => this._orgName() || this.DEFAULT_BRAND_NAME);
  readonly avatarInitial = computed(() => {
    const n = this._name() || this._email();
    return n ? n.trim().charAt(0).toUpperCase() : 'U';
  });

  readonly hasAvatarPhoto = computed(() => !!this._profilePhotoUrl());

  constructor() {
    this.loadFromCache();
  }

  setProfile(p: BrandingProfile | null | undefined): void {
    if (!p) return;
    this._name.set(p.name || p.username || '');
    this._email.set(p.email || '');
    this._profilePhotoUrl.set(p.profile_photo_url || null);
    this._orgLogoUrl.set(p.org_logo_url || null);
    this._orgName.set(p.org_name || null);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(p));
    } catch { /* storage may be unavailable in private mode */ }
  }

  loadFromCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BrandingProfile;
        this._name.set(parsed.name || parsed.username || '');
        this._email.set(parsed.email || '');
        this._profilePhotoUrl.set(parsed.profile_photo_url || null);
        this._orgLogoUrl.set(parsed.org_logo_url || null);
        this._orgName.set(parsed.org_name || null);
      }
    } catch { /* ignore corrupted cache */ }
  }

  reset(): void {
    this._name.set('');
    this._email.set('');
    this._profilePhotoUrl.set(null);
    this._orgLogoUrl.set(null);
    this._orgName.set(null);
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }
}
