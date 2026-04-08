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

const LOG_MESSAGES = [
  'Authenticating credentials...',
  'Establishing encrypted channel...',
  'Loading vessel registry...',
  'Preparing helm interface...',
  'All systems ready.',
];

@Component({
  selector: 'app-launch-transition',
  templateUrl: './launch-transition.component.html',
  styleUrls: ['./launch-transition.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaunchTransitionComponent implements OnInit, OnDestroy {
  @Input() shipName  = 'Ship System';
  @Input() targetUrl = '';
  @Input() shipIcon  = '🚢';
  @Output() launched = new EventEmitter<void>();

  isExpanding    = false;
  isFadingOut    = false;
  showText       = false;
  progress       = 0;
  sweepAngle     = 0;
  visibleMessages: string[] = [];

  // Fake nautical coordinates for visual effect
  coordLat = (Math.random() * 60 + 10).toFixed(4);
  coordLon = (Math.random() * 80 + 20).toFixed(4);

  // Segmented progress: 20 segments → lit at 5,10,15,...100
  progressSegments = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);

  private sweepInterval!: ReturnType<typeof setInterval>;
  private logInterval!:   ReturnType<typeof setTimeout>;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.startSweep();
    this.runLaunchSequence();
  }

  ngOnDestroy(): void {
    clearInterval(this.sweepInterval);
    this.timers.forEach(t => clearTimeout(t));
  }

  private tick(): void { this.cdr.markForCheck(); }

  // ── Continuous radar sweep ─────────────────────────────────────────────
  private startSweep(): void {
    let angle = 0;
    this.sweepInterval = setInterval(() => {
      angle = (angle + 2.5) % 360;
      this.sweepAngle = angle;
      this.tick();
    }, 16); // ~60fps
  }

  // ── Main sequence ──────────────────────────────────────────────────────
  private runLaunchSequence(): void {
    // Step 1 – show text block
    this.delay(500, () => { this.showText = true; this.tick(); });

    // Step 2 – reveal log messages one by one
    LOG_MESSAGES.forEach((msg, i) => {
      this.delay(700 + i * 340, () => {
        this.visibleMessages = [...this.visibleMessages, msg];
        this.tick();
      });
    });

    // Step 3 – animate progress 0 → 100 over 1.8s (starting at 800ms)
    this.delay(800, () => {
      this.animateProgress(0, 100, 1900, (v) => { this.progress = v; this.tick(); });
    });

    // Step 4 – fade out and emit (total ~2900ms)
    this.delay(2900, () => {
      this.isFadingOut = true;
      this.tick();
      this.delay(600, () => {
        this.launched.emit();
        // Note: actual navigation is handled by dashboard's onLaunched()
      });
    });
  }

  private delay(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private animateProgress(
    from: number,
    to: number,
    duration: number,
    onUpdate: (value: number) => void,
  ): void {
    const start = performance.now();
    const step  = (now: number) => {
      const t     = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      onUpdate(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
