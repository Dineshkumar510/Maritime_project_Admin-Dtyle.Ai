import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Ship {
  id: number;
  name: string;
  image_url: string;
  redirect_url: string;
  description?: string;
  status: 'active' | 'inactive' | 'maintenance';
  created_at: string;
}

export interface AddShipPayload {
  name: string;
  redirect_url: string;
  description?: string;
  status?: string;
  image?: File;
  image_url?: string;
}

@Injectable({ providedIn: 'root' })
export class ShipsService {
  private readonly api = `${environment.expressApiUrl}/ships`;

  constructor(private http: HttpClient) {}

  getShips(): Observable<{ ships: Ship[] }> {
    return this.http
      .get<{ ships: Ship[] }>(this.api, { withCredentials: true })
      .pipe(catchError((err) => throwError(() => err)));
  }

  addShip(
    payload: AddShipPayload,
  ): Observable<{ success: boolean; ship: Ship }> {
    const fd = new FormData();
    fd.append('name', payload.name);
    fd.append('redirect_url', payload.redirect_url);
    if (payload.description) fd.append('description', payload.description);
    if (payload.status) fd.append('status', payload.status);
    if (payload.image) fd.append('image', payload.image);
    else if (payload.image_url) fd.append('image_url', payload.image_url);

    return this.http
      .post<{
        success: boolean;
        ship: Ship;
      }>(this.api, fd, { withCredentials: true })
      .pipe(catchError((err) => throwError(() => err)));
  }

  deleteShip(id: number): Observable<{ success: boolean }> {
    return this.http
      .delete<{
        success: boolean;
      }>(`${this.api}/${id}`, { withCredentials: true })
      .pipe(catchError((err) => throwError(() => err)));
  }
}
