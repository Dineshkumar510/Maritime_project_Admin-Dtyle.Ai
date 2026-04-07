import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ShipsService } from '../../services/ships.service';

@Component({
  selector: 'app-add-ship-modal',
  templateUrl: './add-ship-modal.component.html',
  styleUrls: ['./add-ship-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddShipModalComponent {
  form: FormGroup;
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  submitting = signal(false);

  constructor(
    private dialogRef: MatDialogRef<AddShipModalComponent>,
    private fb: FormBuilder,
    private shipsService: ShipsService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      redirect_url: ['', [Validators.required, Validators.pattern('https?://.+')]],
      description: [''],
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.selectedFile.set(file);
      const reader = new FileReader();
      reader.onload = () => this.imagePreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const payload = {
      ...this.form.value,
      image: this.selectedFile(),
    };

    this.shipsService.addShip(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.dialogRef.close(res.ship);
      },
      error: (err) => {
        console.error('Error adding ship', err);
        this.submitting.set(false);
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
