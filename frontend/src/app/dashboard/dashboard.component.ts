import {
  Component, OnInit, ChangeDetectionStrategy, signal, ChangeDetectorRef
} from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../services/auth.service';
import { ShipsService, Ship } from '../services/ships.service';
import { AddShipModalComponent } from './add-ship-modal/add-ship-modal.component';
import { UrlCryptoService } from '../services/url-crypto.service.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  ships       = signal<Ship[]>([]);
  loading     = signal(true);
  toast       = signal('');
  toastType   = signal<'success' | 'error'>('success');
  launchingId = signal<number | null>(null);
  darkMode    = signal(false);

  // Launch screen state
  showLaunchScreen  = signal(false);
  launchingShipName = '';
  launchingShipIcon = '';
  launchTargetUrl   = '';

  readonly year      = new Date().getFullYear();
  readonly skeletons = Array(6).fill(0);

  constructor(
    public auth: AuthService,
    private shipsService: ShipsService,
    private dialog: MatDialog,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private urlCrypto: UrlCryptoService,
  ) {}

  ngOnInit(): void { this.loadShips(); }

  loadShips(): void {
    this.loading.set(true);
    this.shipsService.getShips().subscribe({
      next: (r) => { this.ships.set(r.ships); this.loading.set(false); },
      error: () => { this.loading.set(false); this.showToast('Failed to load ships', 'error'); },
    });
  }

  get activeCount():      number { return this.ships().filter(s => s.status === 'active').length; }
  get maintenanceCount(): number { return this.ships().filter(s => s.status === 'maintenance').length; }
  get inactiveCount():    number { return this.ships().filter(s => s.status === 'inactive').length; }


  openShip(ship: Ship): void {
  if (this.launchingId() !== null || ship.status !== 'active') return;

  this.launchingId.set(ship.id);
  this.cdr.markForCheck();

  this.auth.generateShipToken(ship.id).subscribe({
    next: (res) => {
      this.launchingShipName = ship.name;
      this.launchingShipIcon = ship.image_url || 'assets/default-ship.jpg';
      this.launchTargetUrl   = res.ssoUrl;

      setTimeout(() => {
        this.showLaunchScreen.set(true);
        this.cdr.markForCheck();
      }, 350);
    },
    error: () => {
      this.launchingId.set(null);
      this.showToast('Failed to open ship dashboard', 'error');
      this.cdr.markForCheck();
    },
  });
}

  onLaunched(): void {
    this.showLaunchScreen.set(false);
    this.launchingId.set(null);
    this.cdr.markForCheck();
    const token = this.urlCrypto.encrypt(this.launchTargetUrl, this.launchingShipName);
    this.router.navigate(['/external'], {
      queryParams: { data: token },
    });
  }

  deleteShip(event: MouseEvent, id: number): void {
    event.stopPropagation();
    if (!confirm('Remove this vessel from the registry?')) return;
    this.shipsService.deleteShip(id).subscribe({
      next: () => { this.ships.update(s => s.filter(x => x.id !== id)); this.showToast('Vessel removed'); },
      error: () => this.showToast('Failed to remove vessel', 'error'),
    });
  }

  // ── Edit ──────────────────────────────────────────────────────────────
  editShip(event: MouseEvent, ship: Ship): void {
    event.stopPropagation();
    const ref = this.dialog.open(AddShipModalComponent, {
      width: '520px', maxWidth: '95vw',
      panelClass: this.darkMode() ? ['dtl-modal-dark'] : ['dtl-modal'],
      data: { ship, isEdit: true },
    });
    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.ships.update(s => s.map(x => x.id === updated.id ? updated : x));
        this.showToast('Vessel updated!');
      }
    });
  }

  // ── Add ───────────────────────────────────────────────────────────────
  openAddModal(): void {
    const ref = this.dialog.open(AddShipModalComponent, {
      width: '520px', maxWidth: '95vw',
      panelClass: this.darkMode() ? ['dtl-modal-dark'] : ['dtl-modal'],
    });
    ref.afterClosed().subscribe(ship => {
      if (ship) { this.ships.update(s => [ship, ...s]); this.showToast('Vessel registered!'); }
    });
  }

  toggleDark(): void { this.darkMode.update(v => !v); }
  logout(): void { this.auth.logout(); }

  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    this.toastType.set(type);
    this.toast.set(msg);
    this.cdr.markForCheck();
    setTimeout(() => { this.toast.set(''); this.cdr.markForCheck(); }, 3200);
  }

  statusColor(status: string): string {
    return ({ active: '#00B87A', maintenance: '#E8880A', inactive: '#D93025' }[status] || '#888');
  }

  trackById(_: number, ship: Ship): number { return ship.id; }
}
