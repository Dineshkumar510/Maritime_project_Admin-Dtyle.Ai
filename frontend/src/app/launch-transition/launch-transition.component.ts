import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';

interface StatusMessage {
  text: string;
  status: 'pending' | 'active' | 'complete';
}

@Component({
  selector: 'app-launch-transition',
  templateUrl: './launch-transition.component.html',
  styleUrls: ['./launch-transition.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaunchTransitionComponent implements OnInit, OnDestroy {
  @Input() shipName  = 'Vessel Dashboard';
  @Input() targetUrl = '';
  @Input() shipIcon  = '🚢';
  @Output() launched = new EventEmitter<void>();

  isFadingOut = false;
  progress    = 0;

  messages: StatusMessage[] = [
    { text: 'Authenticating credentials', status: 'pending' },
    { text: 'Establishing encrypted tunnel', status: 'pending' },
    { text: 'Loading vessel interface', status: 'pending' },
    { text: 'Synchronizing data streams', status: 'pending' },
    { text: 'Connection established', status: 'pending' },
  ];

  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.runConnectionSequence();
  }

  ngOnDestroy(): void {
    this.timers.forEach(t => clearTimeout(t));
  }

  private tick(): void {
    this.cdr.markForCheck();
  }

  private runConnectionSequence(): void {
    const stepDuration = 450; // ms per step
    const totalSteps = this.messages.length;

    // Animate progress from 0 to 100 over the total duration
    this.delay(200, () => {
      this.animateProgress(0, 100, totalSteps * stepDuration);
    });

    // Process each message sequentially
    this.messages.forEach((msg, index) => {
      // Mark as active
      this.delay(200 + index * stepDuration, () => {
        this.messages[index].status = 'active';
        this.tick();
      });

      // Mark as complete
      this.delay(200 + (index + 0.7) * stepDuration, () => {
        this.messages[index].status = 'complete';
        this.tick();
      });
    });

    // Fade out and launch
    const totalDuration = 200 + totalSteps * stepDuration + 400;
    this.delay(totalDuration, () => {
      this.isFadingOut = true;
      this.tick();

      this.delay(400, () => {
        this.launched.emit();
      });
    });
  }

  private delay(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private animateProgress(from: number, to: number, duration: number): void {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - t, 3);
      this.progress = Math.round(from + (to - from) * eased);
      this.tick();

      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }
}
