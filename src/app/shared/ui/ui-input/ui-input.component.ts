import { Component, input, model, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ui-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="grid w-full max-w-sm items-center gap-1.5" [class]="containerClass()">
      @if (label()) {
        <label [for]="id()" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-300">
          {{ label() }}
        </label>
      }
      <input
        [type]="type()"
        [id]="id()"
        [placeholder]="placeholder()"
        [(ngModel)]="value"
        [disabled]="disabled()"
        class="flex h-9 w-full rounded-md border border-input px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 border-white/20 bg-black/20 text-white focus:border-green-400 focus:ring-green-400/50"
        [class.border-red-500]="error()"
      />
      @if (error()) {
        <p class="text-sm font-medium text-destructive text-red-400">{{ error() }}</p>
      }
    </div>
  `,
  styles: []
})
export class UiInputComponent {
  // Model signal for two-way binding (Angular 17.2+)
  value = model<string | number>('');

  label = input<string>('');
  type = input<string>('text');
  placeholder = input<string>('');
  id = input<string>(`ui-input-${Math.random().toString(36).substr(2, 9)}`);
  error = input<string | null>(null);
  disabled = input<boolean>(false);
  containerClass = input<string>('');
}
