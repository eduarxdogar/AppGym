import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ui-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="classes()">
      @if (title()) {
        <div class="flex flex-col space-y-1.5 p-6 border-b border-white/10">
          <h3 class="font-semibold leading-none tracking-tight text-foreground">{{ title() }}</h3>
          @if (description()) {
            <p class="text-sm text-muted-foreground">{{ description() }}</p>
          }
        </div>
      }
      
      <div class="p-6 pt-6 flex-1">
        <ng-content></ng-content>
      </div>

      @if (hasFooter()) {
        <div class="flex items-center p-6 pt-0 border-t border-white/10 bg-black/20">
          <ng-content select="[footer]"></ng-content>
        </div>
      }
    </div>
  `,
  styles: []
})
export class UiCardComponent {
  title = input<string>('');
  description = input<string>('');
  customClass = input<string>('bg-surface border border-secondary rounded-xl');
  hasFooter = input<boolean>(false);

  classes = computed(() => {
    return `rounded-xl border border-white/10 bg-black/40 text-card-foreground shadow-sm backdrop-blur-md ${this.customClass()}`;
  });

}