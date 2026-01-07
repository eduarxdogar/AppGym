import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ],
  template: `
    <div class="form-group" [ngClass]="containerClass">
      <label *ngIf="label" [for]="id">{{ label }}</label>
      <input
        [id]="id"
        [type]="type"
        [placeholder]="placeholder"
        [value]="value"
        [disabled]="isDisabled"
        (input)="onInput($event)"
        (blur)="onTouched()"
        class="form-control"
        [ngClass]="{'is-invalid': error}"
      />
      <div class="invalid-feedback" *ngIf="error">
        {{ error }}
      </div>
    </div>
  `,
  styles: [`
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-control {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 1rem;
    }
    .form-control:focus {
      border-color: #007bff;
      outline: none;
      box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
    }
    .is-invalid { border-color: #dc3545; }
    .invalid-feedback { color: #dc3545; font-size: 0.875rem; margin-top: 0.25rem; }
  `]
})
export class InputComponent implements ControlValueAccessor {
  @Input() label: string = '';
  @Input() id: string = `input-${Math.random().toString(36).substr(2, 9)}`;
  @Input() type: string = 'text';
  @Input() placeholder: string = '';
  @Input() error: string | null = null;
  @Input() containerClass: string = '';

  value: string = '';
  isDisabled: boolean = false;

  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: any): void {
    this.value = value || '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value = value;
    this.onChange(value);
  }
}
