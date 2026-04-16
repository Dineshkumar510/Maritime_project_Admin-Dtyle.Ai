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

    if (!(history.state && history.state.navigationLocked)) {
      history.pushState({ navigationLocked: true }, '', window.location.href);
    }

    this.boundBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', this.boundBeforeUnload);

    this.boundPopState = (_e: PopStateEvent) => {
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
    this.targetUrl = '';

    if (this.boundBeforeUnload) {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
    }
    if (this.boundPopState) {
      window.removeEventListener('popstate', this.boundPopState);
    }
    if (history.state && history.state.navigationLocked) {
      history.replaceState({}, '', window.location.href);
    }
  }

  getTargetUrl(): string  { return this.targetUrl; }
  getIsLocked(): boolean  { return this.isLocked;  }
}
