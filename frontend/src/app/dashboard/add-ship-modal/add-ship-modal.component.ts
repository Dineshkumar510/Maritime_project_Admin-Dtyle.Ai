import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  signal,
  Inject,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ShipsService, Ship, AddShipPayload } from '../../services/ships.service';

interface DialogData {
  ship?: Ship;
  isEdit?: boolean;
}

@Component({
  selector: 'app-add-ship-modal',
  templateUrl: './add-ship-modal.component.html',
  styleUrls: ['./add-ship-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddShipModalComponent implements OnInit {
  form!: FormGroup;
  loading = signal(false);
  error = signal('');
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string>('');

  isEditMode = false;
  shipToEdit?: Ship;

  constructor(
    private fb: FormBuilder,
    private shipsService: ShipsService,
    private dialogRef: MatDialogRef<AddShipModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    this.isEditMode = data?.isEdit || false;
    this.shipToEdit = data?.ship;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [this.shipToEdit?.name || '', [Validators.required]],
      redirect_url: [this.shipToEdit?.redirect_url || '', [Validators.required]],
      description: [this.shipToEdit?.description || ''],
      status: [this.shipToEdit?.status || 'active', [Validators.required]],
      image_url: [this.shipToEdit?.image_url || ''],
    });

    // Set initial image preview if editing
    if (this.isEditMode && this.shipToEdit?.image_url) {
      this.imagePreview.set(this.shipToEdit.image_url);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.selectedFile.set(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  clearImage(): void {
    this.selectedFile.set(null);
    this.imagePreview.set('');
    this.form.patchValue({ image_url: '' });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    const payload: AddShipPayload = {
      name: this.form.value.name,
      redirect_url: this.form.value.redirect_url,
      description: this.form.value.description,
      status: this.form.value.status,
    };

    if (this.selectedFile()) {
      payload.image = this.selectedFile()!;
    } else if (this.form.value.image_url) {
      payload.image_url = this.form.value.image_url;
    }

    const request = this.isEditMode && this.shipToEdit
      ? this.shipsService.updateShip(this.shipToEdit.id, payload)
      : this.shipsService.addShip(payload);

    request.subscribe({
      next: (res) => {
        this.loading.set(false);
        this.dialogRef.close(res.ship);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Failed to save ship');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  get title(): string {
    return this.isEditMode ? 'Edit Ship' : 'Add New Ship';
  }

  get submitLabel(): string {
    return this.isEditMode ? 'Update Ship' : 'Add Ship';
  }
}
