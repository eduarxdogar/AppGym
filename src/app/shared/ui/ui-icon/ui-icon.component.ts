import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-ui-icon',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <lucide-icon 
      [name]="name()" 
      [size]="size()" 
      [class]="customClass()">
    </lucide-icon>
  `
})
export class UiIconComponent {
  name = input.required<string>();
  size = input<number>(24);
  customClass = input<string>('');
}
