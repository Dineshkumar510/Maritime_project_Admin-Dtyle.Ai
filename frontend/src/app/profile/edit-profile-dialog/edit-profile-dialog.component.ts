import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, signal,
} from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { BrandingService } from '../../services/branding.service';
import { ProfileService } from '../../services/profile.service';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

@Component({
  selector: 'app-edit-profile-dialog',
  templateUrl: './edit-profile-dialog.component.html',
  styleUrls: ['./edit-profile-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfileDialogComponent {
  private readonly fb       = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<EditProfileDialogComponent>);
  private readonly profile  = inject(ProfileService);
  private readonly snack    = inject(MatSnackBar);
  private readonly cdr      = inject(ChangeDetectorRef);
  readonly  branding        = inject(BrandingService);

  // ── Form: text fields only. Files live outside the form. ──────────────
  readonly form = this.fb.nonNullable.group({
    display_name: [this.branding.name(), [Validators.required, Validators.maxLength(255)]],
    org_name:     [this.branding.orgName() ?? '', [Validators.maxLength(255)]],
  });

  // ── File state (selected but not yet uploaded) ────────────────────────
  photoFile = signal<File | null>(null);
  photoPreview = signal<string | null>(this.branding.profilePhotoUrl() ?? null);
  photoDragActive = signal(false);

  logoFile = signal<File | null>(null);
  logoPreview = signal<string | null>(this.branding.orgLogoUrl() ?? this.branding.DEFAULT_LOGO);
  logoDragActive = signal(false);

  saving = signal(false);

  // ── File pickers ──────────────────────────────────────────────────────

  onPhotoSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.acceptPhoto(file);
    (ev.target as HTMLInputElement).value = '';
  }
  onLogoSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) this.acceptLogo(file);
    (ev.target as HTMLInputElement).value = '';
  }

  // ── Drag & drop ───────────────────────────────────────────────────────

  onDragOver(ev: DragEvent, kind: 'photo' | 'logo'): void {
    ev.preventDefault(); ev.stopPropagation();
    if (kind === 'photo') this.photoDragActive.set(true); else this.logoDragActive.set(true);
  }
  onDragLeave(ev: DragEvent, kind: 'photo' | 'logo'): void {
    ev.preventDefault(); ev.stopPropagation();
    if (kind === 'photo') this.photoDragActive.set(false); else this.logoDragActive.set(false);
  }
  onDrop(ev: DragEvent, kind: 'photo' | 'logo'): void {
    ev.preventDefault(); ev.stopPropagation();
    if (kind === 'photo') this.photoDragActive.set(false); else this.logoDragActive.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (!file) return;
    if (kind === 'photo') this.acceptPhoto(file); else this.acceptLogo(file);
  }

  // ── Validate + preview ────────────────────────────────────────────────

  private acceptPhoto(file: File): void {
    if (!this.validate(file)) return;
    this.photoFile.set(file);
    this.photoPreview.set(URL.createObjectURL(file));
  }
  private acceptLogo(file: File): void {
    if (!this.validate(file)) return;
    this.logoFile.set(file);
    this.logoPreview.set(URL.createObjectURL(file));
  }
  private validate(file: File): boolean {
    if (file.size > MAX_BYTES) {
      this.snack.open(`Image too large (max 10 MB)`, 'OK', { duration: 3500 });
      return false;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      this.snack.open(`Unsupported file type`, 'OK', { duration: 3500 });
      return false;
    }
    return true;
  }

  // ── Clear a previously chosen file (revert to current server value) ───

  clearPhoto(): void {
    this.photoFile.set(null);
    this.photoPreview.set(this.branding.profilePhotoUrl() ?? null);
  }
  clearLogo(): void {
    this.logoFile.set(null);
    this.logoPreview.set(this.branding.orgLogoUrl() ?? this.branding.DEFAULT_LOGO);
  }

  // ── Save ───────────────────────────────────────────────────────────────

  cancel(): void { this.dialogRef.close(false); }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const v = this.form.getRawValue();
    const textChanged =
      v.display_name !== (this.branding.name() ?? '') ||
      (v.org_name || null) !== (this.branding.orgName() ?? null);

    // Build a parallel set of HTTP calls. Each returns Observable<profile>;
    // we don't actually care which payload "wins" because every response
    // pushes the latest profile into BrandingService — last write wins.
    const ops: any[] = [];
    if (textChanged) {
      ops.push(this.profile.update({
        display_name: v.display_name,
        org_name:     v.org_name || '',
      }).pipe(catchError(err => { this.snack.open(this.errMsg(err), 'OK', { duration: 4000 }); return of(null); })));
    }
    if (this.photoFile()) {
      ops.push(this.profile.uploadPhoto(this.photoFile()!).pipe(
        catchError(err => { this.snack.open(this.errMsg(err), 'OK', { duration: 4000 }); return of(null); }),
      ));
    }
    if (this.logoFile()) {
      ops.push(this.profile.uploadLogo(this.logoFile()!).pipe(
        catchError(err => { this.snack.open(this.errMsg(err), 'OK', { duration: 4000 }); return of(null); }),
      ));
    }

    if (ops.length === 0) {
      this.saving.set(false);
      this.dialogRef.close(false);
      return;
    }

    forkJoin(ops).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Profile updated', 'OK', { duration: 2200 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private errMsg(err: any): string {
    return err?.error?.error || err?.message || 'Something went wrong';
  }
}

