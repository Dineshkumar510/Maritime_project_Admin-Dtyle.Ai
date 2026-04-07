import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  ChangeDetectorRef,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../services/auth.service';
import { ShipsService, Ship } from '../services/ships.service';
import { AddShipModalComponent } from './add-ship-modal/add-ship-modal.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  ships = signal<Ship[]>([]);
  loading = signal(true);
  toast = signal('');
  toastType = signal<'success' | 'error'>('success');
  redirecting = signal<number | null>(null);
  darkMode = signal(false);

  readonly year = new Date().getFullYear();

  // Skeleton placeholder array for loading state
  readonly skeletons = Array(6).fill(0);

  constructor(
    public auth: AuthService,
    private shipsService: ShipsService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadShips();
  }

  loadShips(): void {
    this.loading.set(true);
    this.shipsService.getShips().subscribe({
      next: (r) => {
        this.ships.set(r.ships);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Failed to load ships', 'error');
      },
    });
  }

  // ── Ship card click → generate SSO token → redirect to Next.js ────────────
  openShip(ship: Ship): void {
    if (this.redirecting() !== null) return;
    this.redirecting.set(ship.id);

    this.auth.generateShipToken(ship.id).subscribe({
      next: (res) => {
        window.location.href = res.ssoUrl;
      },
      error: () => {
        this.redirecting.set(null);
        this.showToast('Failed to open ship dashboard', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  // ── Delete ship ──────────────────────────────────────────────────────────
  deleteShip(event: MouseEvent, id: number): void {
    event.stopPropagation();
    if (!confirm('Remove this ship?')) return;
    this.shipsService.deleteShip(id).subscribe({
      next: () => {
        this.ships.update((s) => s.filter((x) => x.id !== id));
        this.showToast('Ship removed');
      },
      error: () => this.showToast('Failed to delete ship', 'error'),
    });
  }

  // ── Open "Add Ship" modal ─────────────────────────────────────────────────
  openAddModal(): void {
    const ref = this.dialog.open(AddShipModalComponent, {
      width: '520px',
      maxWidth: '95vw',
      panelClass: this.darkMode() ? ['dtl-modal-dark'] : ['dtl-modal'],
    });
    ref.afterClosed().subscribe((ship) => {
      if (ship) {
        this.ships.update((s) => [ship, ...s]);
        this.showToast('Ship added successfully!');
      }
    });
  }

  toggleDark(): void {
    this.darkMode.update((v) => !v);
  }
  logout(): void {
    this.auth.logout();
  }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastType.set(type);
    this.toast.set(msg);
    this.cdr.markForCheck();
    setTimeout(() => {
      this.toast.set('');
      this.cdr.markForCheck();
    }, 3200);
  }

  statusColor(status: string): string {
    return (
      { active: '#00a888', maintenance: '#f09820', inactive: '#d03030' }[
        status
      ] || '#888'
    );
  }

  trackById(_: number, ship: Ship): number {
    return ship.id;
  }
}
