import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      [type]="type" 
      [className]="'btn btn-' + variant + ' ' + customClass"
      [disabled]="disabled"
      (click)="onClick($event)">
      <ng-content></ng-content>
      {{ label }}
    </button>
  `,
  styles: [`
    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-primary { background-color: #007bff; color: white; }
    .btn-secondary { background-color: #6c757d; color: white; }
    .btn-danger { background-color: #dc3545; color: white; }
    .btn-outline { background-color: transparent; border: 1px solid #ccc; color: #333; }
    .btn-outline:hover { background-color: #f8f9fa; }
  `]
})
export class ButtonComponent {
  @Input() label: string = '';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() variant: ButtonVariant = 'primary';
  @Input() disabled: boolean = false;
  @Input() customClass: string = '';

  @Output() clicked = new EventEmitter<Event>();

  onClick(event: Event) {
    if (!this.disabled) {
      this.clicked.emit(event);
    }
  }
}
