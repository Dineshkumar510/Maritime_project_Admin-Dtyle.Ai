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
  targetUrl     = '';
  shipName      = 'External System';
  safeUrl!: SafeResourceUrl;
  bannerVisible  = false;
  showWarning    = false;
  isLoading      = true;
  decryptError   = false;
  currentTime    = '';

  private navLockListener!: EventListener;
  private clockInterval!: ReturnType<typeof setInterval>;

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

    this.route.queryParams.subscribe(params => {
      const token = params['data'] || '';

      if (token) {
        // 🔐 Decrypt the opaque token
        const decoded = this.urlCrypto.decrypt(token);

        if (decoded) {
          this.targetUrl = decoded.url;
          this.shipName  = decoded.name;
          this.safeUrl   = this.sanitizer.bypassSecurityTrustResourceUrl(this.targetUrl);
          this.decryptError = false;
        } else {
          this.decryptError = true;
          console.error('[ExternalViewer] Failed to decrypt navigation token.');
        }
      } else {
        this.decryptError = true;
      }

      this.cdr.markForCheck();
    });

    // Slide banner in after a moment
    setTimeout(() => { this.bannerVisible = true; this.cdr.markForCheck(); }, 400);
    // Hide iframe loader after a reasonable delay
    setTimeout(() => { this.isLoading = false; this.cdr.markForCheck(); }, 3000);

    // Activate navigation lock
    this.navLock.lock(this.targetUrl);

    // Show warning modal whenever the lock intercepts back/forward
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
  }

  onIframeLoad(): void {
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  dismissWarning(): void {
    this.showWarning = false;
    this.cdr.markForCheck();
  }

  confirmLeave(): void {
    this.showWarning = false;
    this.navLock.unlock();
    this.router.navigate(['/dashboard']);
  }

  returnToDashboard(): void {
    this.navLock.unlock();
    this.router.navigate(['/dashboard']);
  }

  private updateClock(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }
}
