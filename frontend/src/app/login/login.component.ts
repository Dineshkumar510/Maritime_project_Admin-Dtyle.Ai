import { Component, OnInit, ChangeDetectionStrategy, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector        : 'app-login',
  templateUrl     : './login.component.html',
  styleUrls       : ['./login.component.scss'],
  changeDetection : ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {

  form!     : FormGroup;
  loading   = signal(false);
  error     = signal('');
  hidePass  = signal(true);
  returnUrl = '/dashboard';

  readonly year = new Date().getFullYear();
  @ViewChild('card') private cardRef!: ElementRef<HTMLDivElement>;

  constructor(
    private fb    : FormBuilder,
    private auth  : AuthService,
    private router: Router,
    private route : ActivatedRoute,
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
      return;
    }

    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';

    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(1)]],
    });

    const urlError = this.route.snapshot.queryParamMap.get('error');
    if (urlError === 'session_expired') {
      this.error.set('Your session has expired. Please sign in again.');
    }
  }

  get f() { return this.form.controls; }

  onTilt(event: MouseEvent): void {
    const card = this.cardRef?.nativeElement;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width  - 0.5;
    const y = (event.clientY - rect.top)  / rect.height - 0.5;
    card.style.transition = 'transform 0.08s ease-out, box-shadow 0.08s ease-out';
    card.style.transform  =
      `perspective(1100px) rotateY(${x * 16}deg) rotateX(${-y * 11}deg) translateZ(18px)`;
    card.style.boxShadow  = [
      `${-x * 30}px ${y * 15}px 50px rgba(0,100,200,0.14)`,
      `0 24px 70px rgba(0,70,150,0.12)`,
      `${-x * 12}px ${y * 6}px 24px rgba(0,150,210,0.08)`,
      `inset 0 1px 0 rgba(255,255,255,0.95)`,
    ].join(', ');
  }

  // ── Fix 2: resetTilt — restore card on mouse-leave ───────────────────────
  resetTilt(): void {
    const card = this.cardRef?.nativeElement;
    if (!card) return;
    card.style.transition =
      'transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.55s cubic-bezier(0.23,1,0.32,1)';
    card.style.transform  = 'perspective(1100px) rotateY(0deg) rotateX(0deg) translateZ(0px)';
    card.style.boxShadow  =
      '0 20px 60px rgba(0,80,160,0.1), 0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)';
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    const { username, password } = this.form.value;

    this.auth.login(username.trim(), password).subscribe({
      next : ()  => { /* AuthService handles the redirect to Next.js */ },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Sign in failed. Please try again.');
      },
    });
  }
}
