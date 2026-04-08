import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';

@Component({
  selector: 'app-launch-transition',
  templateUrl: './launch-transition.component.html',
  styleUrls: ['./launch-transition.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaunchTransitionComponent implements OnInit {
  @Input() shipName  = 'Ship System';
  @Input() targetUrl = '';
  @Input() shipIcon  = '🚢';
  @Output() launched = new EventEmitter<void>();

  isExpanding  = false;
  isFadingOut  = false;
  showText     = false;
  progress     = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.runLaunchSequence();
  }

  private tick(): void {
    this.cdr.markForCheck();
  }

  private runLaunchSequence(): void {
    // Step 1 – expand icon rings
    setTimeout(() => { this.isExpanding = true; this.tick(); }, 100);

    // Step 2 – reveal text + progress bar
    setTimeout(() => { this.showText = true; this.tick(); }, 600);

    // Step 3 – animate progress 0 → 100 over 1.8s
    this.animateProgress(0, 100, 1800, (v) => { this.progress = v; this.tick(); });

    // Step 4 – fade out, emit, redirect
    setTimeout(() => {
      this.isFadingOut = true;
      this.tick();
      setTimeout(() => {
        this.launched.emit();
        window.location.href = this.targetUrl;
      }, 500);
    }, 2600);
  }

  private animateProgress(
    from: number,
    to: number,
    duration: number,
    onUpdate: (value: number) => void,
  ): void {
    const start = performance.now();
    const step  = (now: number) => {
      const t      = Math.min((now - start) / duration, 1);
      const eased  = 1 - Math.pow(1 - t, 3); // ease-out cubic
      onUpdate(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
