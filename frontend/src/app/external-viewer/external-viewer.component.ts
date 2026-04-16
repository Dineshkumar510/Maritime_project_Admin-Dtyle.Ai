import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavigationLockService } from '../services/navigation-lock.service';
import { UrlCryptoService } from '../services/url-crypto.service.service';

@Component({
  selector: 'app-external-viewer',
  templateUrl: './external-viewer.component.html',
  styleUrls: ['./external-viewer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExternalViewerComponent implements OnInit, OnDestroy {
  targetUrl      = '';
  shipName       = 'External System';
  safeUrl!: SafeResourceUrl;
  bannerVisible  = false;
  showWarning    = false;
  isLoading      = true;
  decryptError   = false;
  urlUnreachable = false;
  currentTime    = '';

  private navLockListener!: EventListener;
  private clockInterval!:   ReturnType<typeof setInterval>;
  private loadingTimeout!:  ReturnType<typeof setTimeout>;

  constructor(
    private route:      ActivatedRoute,
    private router:     Router,
    private sanitizer:  DomSanitizer,
    private navLock:    NavigationLockService,
    private cdr:        ChangeDetectorRef,
    private urlCrypto:  UrlCryptoService,
  ) {}

  ngOnInit(): void {
    this.updateClock();
    this.clockInterval = setInterval(() => { this.updateClock(); this.cdr.markForCheck(); }, 1000);

    this.route.queryParams.subscribe(async params => {
      const token = params['data'] || '';

      if (token) {
        const decoded = this.urlCrypto.decrypt(token);

        if (decoded) {
          this.targetUrl      = decoded.url;
          this.shipName       = decoded.name;
          this.decryptError   = false;
          this.urlUnreachable = false;
          this.isLoading      = true;
          this.cdr.markForCheck();

          // Pre-flight connectivity check before rendering iframe
          const reachable = await this.checkUrl(this.targetUrl);

          if (!reachable) {
            this.isLoading      = false;
            this.urlUnreachable = true;
            this.cdr.markForCheck();
            return;
          }

          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.targetUrl);
          this.cdr.markForCheck();

          // Fallback: hide skeleton after 8s if iframe (load) never fires
          this.loadingTimeout = setTimeout(() => {
            this.isLoading = false;
            this.cdr.markForCheck();
          }, 8000);

        } else {
          this.decryptError = true;
          this.isLoading    = false;
          console.error('[ExternalViewer] Failed to decrypt navigation token.');
        }
      } else {
        this.decryptError = true;
        this.isLoading    = false;
      }

      this.cdr.markForCheck();
    });

    setTimeout(() => { this.bannerVisible = true; this.cdr.markForCheck(); }, 400);
    this.navLock.lock(this.targetUrl);

    this.navLockListener = () => {
      this.showWarning = true;
      this.cdr.markForCheck();
    };
    window.addEventListener('nav-lock-triggered', this.navLockListener);
  }

  ngOnDestroy(): void {
    this.navLock.unlock();
    window.removeEventListener('nav-lock-triggered', this.navLockListener);
    clearInterval(this.clockInterval);
    clearTimeout(this.loadingTimeout);
  }

  onIframeLoad(): void {
    clearTimeout(this.loadingTimeout);
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  dismissWarning(): void    { this.showWarning = false; this.cdr.markForCheck(); }
  confirmLeave(): void      { this.showWarning = false; this.navLock.unlock(); this.router.navigate(['/dashboard']); }
  returnToDashboard(): void { this.navLock.unlock(); this.router.navigate(['/dashboard']); }

  retryConnection(): void {
    this.urlUnreachable = false;
    this.isLoading      = true;
    this.cdr.markForCheck();

    this.checkUrl(this.targetUrl).then(ok => {
      if (ok) {
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.targetUrl);
        this.loadingTimeout = setTimeout(() => { this.isLoading = false; this.cdr.markForCheck(); }, 8000);
      } else {
        this.urlUnreachable = true;
        this.isLoading      = false;
      }
      this.cdr.markForCheck();
    });
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
      hour12: false, timeZone: 'UTC',
    });
  }
}
