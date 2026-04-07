import { inject }              from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService }          from '../services/auth.service';

/** Protects routes that require a logged-in admin */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

export const roleGuard = (...roles: string[]): CanActivateFn => () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) { router.navigate(['/login']); return false; }
  if (auth.hasRole(...roles)) return true;

  router.navigate(['/unauthorized']);
  return false;
};
