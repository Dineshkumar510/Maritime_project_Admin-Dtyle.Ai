import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { NavigationLockService } from '../services/navigation-lock.service';
import { UrlCryptoService } from '../services/url-crypto.service.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-external-viewer',
  templateUrl: './external-viewer.component.html',
  styleUrls: ['./external-viewer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExternalViewerComponent implements OnInit, OnDestroy {
  targetUrl= '';
  shipName='External System';
  safeUrl!:SafeResourceUrl;
  bannerVisible= false;
  showWarning=false;
  isLoading=true;
  isFadingOut=false;
  decryptError=false;
  urlUnreachable=false;
  currentTime='';

  private readonly SETTLE_MS = 2000;
  private readonly HARD_CEILING_MS = 25000;
  private readonly FADE_OUT_MS = 320;

  private navLockListener!:EventListener;
  private vesselReadyListener?:(e: MessageEvent) => void;
  private clockInterval!:ReturnType<typeof setInterval>;
  private settleTimer?:ReturnType<typeof setTimeout>;
  private hardCeilingTimer?:ReturnType<typeof setTimeout>;
  private fadeTimer?:ReturnType<typeof setTimeout>;
  private bannerTimeout!:ReturnType<typeof setTimeout>;
  private paramsSub?:Subscription;
  private locked = false;

  private currentShipId: number | null = null;

  constructor(
    private route:ActivatedRoute,
    private router:Router,
    private sanitizer:DomSanitizer,
    private navLock:NavigationLockService,
    private cdr:ChangeDetectorRef,
    private urlCrypto:UrlCryptoService,
    private auth:AuthService,
  ) {}

  ngOnInit(): void {
    this.updateClock();
    this.clockInterval = setInterval(() => {
      this.updateClock();
      this.cdr.markForCheck();
    }, 1000);

    this.bannerTimeout = setTimeout(() => {
      this.bannerVisible = true;
      this.cdr.markForCheck();
    }, 400);

    this.navLockListener = () => {
      this.showWarning = true;
      this.cdr.markForCheck();
    };
    window.addEventListener('nav-lock-triggered', this.navLockListener);
    this.vesselReadyListener = (e: MessageEvent) => {
      const data: any = e?.data;
      if (data && typeof data === 'object' && data.type === 'dtyle:vessel-ready') {
        this.beginFadeOut();
      }
    };
    window.addEventListener('message', this.vesselReadyListener);

    this.paramsSub = this.route.queryParams.subscribe(async params => {
      const token = params['data'] || '';

      this.decryptError   = false;
      this.urlUnreachable = false;
      this.isLoading      = true;
      this.isFadingOut    = false;
      this.cdr.markForCheck();

      if (!token) {
        this.decryptError = true;
        this.isLoading    = false;
        this.cdr.markForCheck();
        return;
      }

      const decoded = this.urlCrypto.decryptShipRef(token);
      if (!decoded) {
        this.decryptError = true;
        this.isLoading    = false;
        console.error('[ExternalViewer] Failed to decrypt navigation token.');
        this.cdr.markForCheck();
        return;
      }

      this.shipName       = decoded.name;
      this.currentShipId  = decoded.shipId;
      this.cdr.markForCheck();
      await this.loadFreshSsoUrlAndRender(decoded.shipId);
    });
  }

  private async loadFreshSsoUrlAndRender(shipId: number): Promise<void> {
    try {
      const res = await this.auth.generateShipToken(shipId).toPromise();
      if (!res || !res.success || !res.ssoUrl) {
        this.urlUnreachable = true;
        this.isLoading      = false;
        this.cdr.markForCheck();
        return;
      }

      this.targetUrl = res.ssoUrl;
      this.cdr.markForCheck();

      const reachable = await this.checkUrl(this.targetUrl);
      if (!reachable) {
        this.urlUnreachable = true;
        this.isLoading      = false;
        this.cdr.markForCheck();
        return;
      }

      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.targetUrl);
      this.cdr.markForCheck();

      if (!this.locked) {
        this.navLock.lock(this.targetUrl);
        this.locked = true;
      }

      this.armHardCeiling();
    } catch (err) {
      console.error('[ExternalViewer] generateShipToken failed:', err);
      this.urlUnreachable = true;
      this.isLoading      = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    if (this.locked) {
      this.navLock.unlock();
      this.locked = false;
    }
    window.removeEventListener('nav-lock-triggered', this.navLockListener);
    if (this.vesselReadyListener) {
      window.removeEventListener('message', this.vesselReadyListener);
    }
    clearInterval(this.clockInterval);
    clearTimeout(this.settleTimer);
    clearTimeout(this.hardCeilingTimer);
    clearTimeout(this.fadeTimer);
    clearTimeout(this.bannerTimeout);
    this.paramsSub?.unsubscribe();
  }

  onIframeLoad(): void {
    if (!this.isLoading) return;
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.beginFadeOut(), this.SETTLE_MS);
  }

  private beginFadeOut(): void {
    if (!this.isLoading || this.isFadingOut) return;
    clearTimeout(this.settleTimer);
    clearTimeout(this.hardCeilingTimer);
    this.isFadingOut = true;
    this.cdr.markForCheck();

    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => {
      this.isLoading   = false;
      this.isFadingOut = false;
      this.cdr.markForCheck();
    }, this.FADE_OUT_MS);
  }

  private armHardCeiling(): void {
    clearTimeout(this.hardCeilingTimer);
    this.hardCeilingTimer = setTimeout(() => this.beginFadeOut(), this.HARD_CEILING_MS);
  }

  dismissWarning(): void { this.showWarning = false; this.cdr.markForCheck(); }

  confirmLeave(): void {
    this.showWarning = false;
    if (this.locked) {
      this.navLock.unlock();
      this.locked = false;
    }
    this.router.navigate(['/dashboard']);
  }

  returnToDashboard(): void {
    if (this.locked) {
      this.navLock.unlock();
      this.locked = false;
    }
    this.router.navigate(['/dashboard']);
  }

  retryConnection(): void {
    if (this.currentShipId == null) {
      this.urlUnreachable = true;
      this.cdr.markForCheck();
      return;
    }
    this.urlUnreachable = false;
    this.isLoading      = true;
    this.isFadingOut    = false;
    clearTimeout(this.settleTimer);
    clearTimeout(this.hardCeilingTimer);
    clearTimeout(this.fadeTimer);
    this.cdr.markForCheck();
    this.loadFreshSsoUrlAndRender(this.currentShipId);
  }

  private async checkUrl(url: string): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 10000);
      await fetch(url, { mode: 'no-cors', signal: ctrl.signal });
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'Asia/Kolkata',
    });
  }
}
