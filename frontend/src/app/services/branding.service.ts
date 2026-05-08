import { Injectable, signal, computed } from '@angular/core';

export interface BrandingProfile {
  id: number;
  username?: string;
  name: string;                       // display_name (falls back to username server-side)
  email: string;
  role?: string;
  profile_photo_url?: string | null;
  org_logo_url?: string | null;
  org_name?: string | null;
}

const CACHE_KEY = 'maritime_branding';

@Injectable({ providedIn: 'root' })
export class BrandingService {
  // Defaults match the static HTML so the UI doesn't break if no profile loads.
  readonly DEFAULT_LOGO = 'assets/D-logo.png';
  readonly DEFAULT_BRAND_NAME = 'Dtyle.AI';

  private _name             = signal<string>('');
  private _email            = signal<string>('');
  private _profilePhotoUrl  = signal<string | null>(null);
  private _orgLogoUrl       = signal<string | null>(null);
  private _orgName          = signal<string | null>(null);

  /** Display name (e.g. "Admin") */
  readonly name             = this._name.asReadonly();
  readonly email            = this._email.asReadonly();
  readonly profilePhotoUrl  = this._profilePhotoUrl.asReadonly();
  readonly orgLogoUrl       = this._orgLogoUrl.asReadonly();
  readonly orgName          = this._orgName.asReadonly();

  /** Logo URL with fallback to the bundled default. Templates bind to this. */
  readonly brandLogo = computed(() => this._orgLogoUrl() || this.DEFAULT_LOGO);

  /** Brand text with fallback. Templates bind to this. */
  readonly brandName = computed(() => this._orgName() || this.DEFAULT_BRAND_NAME);

  /** Single uppercase initial for the avatar bubble. */
  readonly avatarInitial = computed(() => {
    const n = this._name() || this._email();
    return n ? n.trim().charAt(0).toUpperCase() : 'U';
  });

  /** Whether to render the photo (`<img>`) or the initial bubble. */
  readonly hasAvatarPhoto = computed(() => !!this._profilePhotoUrl());

  constructor() {
    this.loadFromCache();
  }

  /**
   * Replace the entire branding state from a server response.
   * Also writes through to sessionStorage so a hard refresh shows the
   * current brand instantly (no flash of "Dtyle.AI" defaults).
   */
  setProfile(p: BrandingProfile | null | undefined): void {
    if (!p) return;
    this._name.set(p.name || p.username || '');
    this._email.set(p.email || '');
    this._profilePhotoUrl.set(p.profile_photo_url || null);
    this._orgLogoUrl.set(p.org_logo_url || null);
    this._orgName.set(p.org_name || null);
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(p));
    } catch { /* storage may be unavailable in private mode */ }
  }

  /**
   * Hydrate from the previous session so the brand shows before any
   * network round-trip completes. Called from the constructor.
   */
  loadFromCache(): void {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
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

  /** Wipe everything — call from logout. */
  reset(): void {
    this._name.set('');
    this._email.set('');
    this._profilePhotoUrl.set(null);
    this._orgLogoUrl.set(null);
    this._orgName.set(null);
    try { sessionStorage.removeItem(CACHE_KEY); } catch {}
  }
}
