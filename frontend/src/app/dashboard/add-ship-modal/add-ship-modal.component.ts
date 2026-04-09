import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  signal,
  Inject,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ShipsService, Ship, AddShipPayload } from '../../services/ships.service';
import { UrlCryptoService } from '../../services/url-crypto.service.service';

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
export class AddShipModalComponent implements OnInit, AfterViewInit {

  @ViewChild('urlInputRef') urlInputRef!: ElementRef<HTMLInputElement>;

  form!: FormGroup;
  loading      = signal(false);
  error        = signal('');
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string>('');

  // Holds the actual URL — never shown directly in the input when blurred
  realUrlValue = signal('');
  urlFocused   = signal(false);
  urlHasValue  = signal(false);

  isEditMode = false;
  shipToEdit?: Ship;

  constructor(
    private fb:           FormBuilder,
    private shipsService: ShipsService,
    private dialogRef:    MatDialogRef<AddShipModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    this.isEditMode = data?.isEdit || false;
    this.shipToEdit = data?.ship;
  }

  ngOnInit(): void {
    const existingUrl = this.shipToEdit?.redirect_url || '';

    this.form = this.fb.group({
      name:         [this.shipToEdit?.name        || '', [Validators.required]],
      redirect_url: [existingUrl,                        [Validators.required]],
      description:  [this.shipToEdit?.description || ''],
      status:       [this.shipToEdit?.status      || 'active', [Validators.required]],
      image_url:    [this.shipToEdit?.image_url   || ''],
    });

    this.realUrlValue.set(existingUrl);
    this.urlHasValue.set(!!existingUrl);

    if (this.isEditMode && this.shipToEdit?.image_url) {
      this.imagePreview.set(this.shipToEdit.image_url);
    }
  }

  ngAfterViewInit(): void {
    // In edit mode (or if URL was pre-filled), show encrypted string immediately
    if (this.realUrlValue() && this.urlInputRef) {
      this.urlInputRef.nativeElement.value = this.encryptForDisplay(this.realUrlValue());
    }
  }

  // ── URL field event handlers ───────────────────────────────────────

  onUrlFocus(): void {
    this.urlFocused.set(true);
    // Reveal the real URL so the user can edit it
    this.urlInputRef.nativeElement.value = this.realUrlValue();
  }

  onUrlBlur(event: FocusEvent): void {
    const val = (event.target as HTMLInputElement).value.trim();
    this.realUrlValue.set(val);
    this.urlHasValue.set(!!val);
    this.form.patchValue({ redirect_url: val });
    this.form.get('redirect_url')?.markAsTouched();
    this.urlFocused.set(false);

    // Convert to encrypted display the moment user leaves the field
    this.urlInputRef.nativeElement.value = val
      ? this.encryptForDisplay(val)
      : '';
  }

  onUrlInput(event: Event): void {
    // While typing: keep real value + form control in sync
    const val = (event.target as HTMLInputElement).value;
    this.realUrlValue.set(val);
    this.urlHasValue.set(!!val);
    this.form.patchValue({ redirect_url: val });
  }

  /**
   * Deterministic visual cipher — same input always produces the same display.
   * Output format: colon-separated 4-char hex blocks
   * e.g. "https://ship.example.com" → "4a3f:2b1c:9e4d:8a5f:..."
   */
  encryptForDisplay(url: string): string {
    if (!url) return '';
    const hex = '0123456789abcdef';
    let raw = '';
    for (let i = 0; i < url.length; i++) {
      const c = url.charCodeAt(i);
      raw += hex[(c ^ (i * 13 + 47)) & 0xF];
      raw += hex[((c ^ (i * 7  + 83)) >> 4) & 0xF];
    }
    return (raw.match(/.{1,4}/g) || []).join(':');
  }

  // ── Image ─────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = (e) => this.imagePreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  clearImage(): void {
    this.selectedFile.set(null);
    this.imagePreview.set('');
    this.form.patchValue({ image_url: '' });
  }

  // ── Submit ────────────────────────────────────────────────────────

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');

    const payload: AddShipPayload = {
      name:         this.form.value.name,
      redirect_url: this.form.value.redirect_url,   // real URL sent to backend
      description:  this.form.value.description,
      status:       this.form.value.status,
    };

    if (this.selectedFile())            payload.image     = this.selectedFile()!;
    else if (this.form.value.image_url) payload.image_url = this.form.value.image_url;

    const request = this.isEditMode && this.shipToEdit
      ? this.shipsService.updateShip(this.shipToEdit.id, payload)
      : this.shipsService.addShip(payload);

    request.subscribe({
      next:  (res) => { this.loading.set(false); this.dialogRef.close(res.ship); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Failed to save ship');
      },
    });
  }

  cancel(): void { this.dialogRef.close(); }

  get title():       string { return this.isEditMode ? 'Edit Vessel' : 'Register Vessel'; }
  get submitLabel(): string { return this.isEditMode ? 'Save Changes' : 'Register Vessel'; }
}
