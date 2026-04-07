import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  const authReq = req.clone({
    withCredentials: true,
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
  });

  return next(authReq).pipe(
    catchError((err) => {
      if (
        err.status === 401 &&
        !req.url.includes('/refresh') &&
        !req.url.includes('/login')
      ) {
        return auth.refreshToken().pipe(
          switchMap((res) => {
            const retryReq = req.clone({
              withCredentials: true,
              setHeaders: { Authorization: `Bearer ${res.token}` },
            });
            return next(retryReq);
          }),
          catchError((refreshErr) => {
            auth.logout();
            return throwError(() => refreshErr);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
