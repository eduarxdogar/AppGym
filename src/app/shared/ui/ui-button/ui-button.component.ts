import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type UiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type UiButtonSize = 'sm' | 'md' | 'lg' | 'icon';

@Component({
  selector: 'app-ui-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [class]="classes()"
      [disabled]="disabled()"
      (click)="handleClick($event)"
      [type]="type()">
      <ng-content></ng-content>
      @if (label()) {
        <span>{{ label() }}</span>
      }
    </button>
  `,
  styles: []
})
export class UiButtonComponent {
  // Inputs using Signals
  label = input<string>('');
  variant = input<UiButtonVariant>('primary');
  size = input<UiButtonSize>('md');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input<boolean>(false);
  customClass = input<string>('');

  // Outputs using Signals
  clicked = output<Event>();

  // Computed classes (simulating cva)
  classes = computed(() => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-all duration-200';
    
    const variants: Record<UiButtonVariant, string> = {
      primary: 'bg-primary text-black font-bold hover:opacity-90 shadow-[0_0_15px_rgba(204,252,126,0.3)] hover:bg-primary/90 border border-primary/20', // Neon effect hint
      secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground text-foreground',
      outline: 'border border-input bg-background/50 backdrop-blur-sm shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-accent',
      danger: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-[0_0_15px_rgba(239,68,68,0.5)]'
    };

    const sizes: Record<UiButtonSize, string> = {
      sm: 'h-8 rounded-md px-3 text-xs',
      md: 'h-9 px-4 py-2',
      lg: 'h-10 rounded-md px-8',
      icon: 'h-9 w-9'
    };

    return [
      baseClasses,
      variants[this.variant()],
      sizes[this.size()],
      this.customClass()
    ].join(' ');
  });

  handleClick(event: Event) {
    if (!this.disabled()) {
      this.clicked.emit(event);
    }
  }
}
