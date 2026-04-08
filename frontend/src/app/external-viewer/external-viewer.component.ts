import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavigationLockService } from '../services/navigation-lock.service';

@Component({
  selector: 'app-external-viewer',
  templateUrl: './external-viewer.component.html',
  styleUrls: ['./external-viewer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExternalViewerComponent implements OnInit, OnDestroy {
  targetUrl    = '';
  shipName     = 'External System';
  safeUrl!: SafeResourceUrl;
  bannerVisible = false;
  showWarning   = false;

  private navLockListener!: EventListener;

  constructor(
    private route:     ActivatedRoute,
    private router:    Router,
    private sanitizer: DomSanitizer,
    private navLock:   NavigationLockService,
    private cdr:       ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.targetUrl = params['url']  || '';
      this.shipName  = params['name'] || 'External System';

      if (this.targetUrl) {
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.targetUrl);
      }
      this.cdr.markForCheck();
    });

    // Slide banner in after a moment
    setTimeout(() => { this.bannerVisible = true; this.cdr.markForCheck(); }, 300);

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
}
