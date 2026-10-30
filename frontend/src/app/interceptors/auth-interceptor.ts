
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('devtrack_token');

  // Attach the token only to requests sent to our backend.
  if (
    token &&
    req.url.startsWith('http://localhost:3000/')
  ) {
    const authenticatedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next(authenticatedRequest);
  }

  return next(req);
};
