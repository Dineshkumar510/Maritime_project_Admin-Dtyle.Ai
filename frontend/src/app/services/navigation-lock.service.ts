import { Injectable, NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationLockService {
  private isLocked = false;
  private targetUrl = '';
  private boundBeforeUnload!: (e: BeforeUnloadEvent) => void;
  private boundPopState!: (e: PopStateEvent) => void;

  constructor(private ngZone: NgZone) {}

  lock(targetUrl: string): void {
    if (this.isLocked) return;
    this.isLocked = true;
    this.targetUrl = targetUrl;

    // Push a sentinel entry so the first back-press lands here, not the dashboard
    history.pushState({ navigationLocked: true }, '', window.location.href);

    this.boundBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';   // required for Chrome/Edge to show the native dialog
    };
    window.addEventListener('beforeunload', this.boundBeforeUnload);

    this.boundPopState = (_e: PopStateEvent) => {
      // Re-push so the user can never actually navigate away via back/forward
      history.pushState({ navigationLocked: true }, '', window.location.href);
      this.ngZone.run(() => {
        window.dispatchEvent(new CustomEvent('nav-lock-triggered'));
      });
    };
    window.addEventListener('popstate', this.boundPopState);
  }

  unlock(): void {
    if (!this.isLocked) return;
    this.isLocked = false;
    window.removeEventListener('beforeunload', this.boundBeforeUnload);
    window.removeEventListener('popstate', this.boundPopState);
  }

  getTargetUrl(): string  { return this.targetUrl; }
  getIsLocked(): boolean  { return this.isLocked;  }
}
