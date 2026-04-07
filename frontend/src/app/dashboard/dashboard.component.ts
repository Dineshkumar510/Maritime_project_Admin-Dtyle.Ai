import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ShipsService, Ship } from '../services/ships.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  ships = signal<Ship[]>([]);
  loading = signal(true);
  toast = signal('');
  showModal = signal(false);
  redirecting = signal<number | null>(null);
  darkMode = signal(false);

  constructor(
    public auth: AuthService,
    private shipsService: ShipsService,
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
        this.showToast('Failed to load ships');
      },
    });
  }

  onShipAdded(ship: Ship): void {
    this.ships.update((s) => [ship, ...s]);
    this.showModal.set(false);
    this.showToast('Ship added successfully!');
  }

  onShipDeleted(id: number): void {
    this.shipsService.deleteShip(id).subscribe({
      next: () => {
        this.ships.update((s) => s.filter((x) => x.id !== id));
        this.showToast('Ship removed');
      },
      error: () => this.showToast('Failed to delete ship'),
    });
  }

  openShip(ship: Ship): void {
    this.redirecting.set(ship.id);
    this.auth.generateShipToken(ship.id).subscribe({
      next: (res) => {
        window.location.href = res.ssoUrl;
      },
      error: () => {
        this.redirecting.set(null);
        this.showToast('Failed to open ship dashboard');
      },
    });
  }

  toggleDark(): void {
    this.darkMode.update((v) => !v);
  }
  logout(): void {
    this.auth.logout();
  }

  showToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
