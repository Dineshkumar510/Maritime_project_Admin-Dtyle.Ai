import {
  Component, ChangeDetectionStrategy, ElementRef, HostListener, ViewChild, inject,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BrandingService } from '../../services/branding.service';
import { AuthService } from '../../services/auth.service';
import { EditProfileDialogComponent } from '../edit-profile-dialog/edit-profile-dialog.component';

@Component({
  selector: 'app-profile-menu',
  templateUrl: './profile-menu.component.html',
  styleUrls: ['./profile-menu.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMenuComponent {
  readonly branding = inject(BrandingService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  @ViewChild('root', { static: true }) root!: ElementRef<HTMLElement>;

  open = false;

  toggle(ev?: MouseEvent): void {
    ev?.stopPropagation();
    this.open = !this.open;
  }

  // Close on outside click — bound at the document level so any click
  // anywhere outside the component shuts the dropdown.
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open) return;
    const target = ev.target as Node | null;
    if (target && !this.root.nativeElement.contains(target)) this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.open = false;
  }

  editProfile(): void {
    this.open = false;
    this.dialog.open(EditProfileDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      autoFocus: false,
      panelClass: 'dtl-edit-profile-dialog',
    });
  }

  logout(): void {
    this.open = false;
    this.auth.logout();
  }
}
