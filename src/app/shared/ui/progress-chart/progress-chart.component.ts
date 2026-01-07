import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-48 relative bg-black/20 rounded-lg p-4 border border-white/5">
      <!-- Title -->
      @if (title()) {
        <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{{ title() }}</h4>
      }

      <!-- Chart Area -->
      <svg class="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        <!-- Bars -->
        @for (item of normalizedData(); track $index) {
          <rect
            [attr.x]="$index * (100 / count()) + 2"
            [attr.y]="100 - item.value"
            [attr.width]="(100 / count()) - 4"
            [attr.height]="item.value"
            class="fill-primary/80 hover:fill-primary transition-all duration-300 cursor-pointer"
          >
            <title>{{ labels()[$index] }}: {{ data()[$index] }}</title>
          </rect>
        }
        
        <!-- Gradient Line (if we wanted a line chart variant later) -->
      </svg>
      
      <!-- Axis Labels (Simplified) -->
      <div class="flex justify-between mt-2 text-[10px] text-gray-500 font-mono">
        @for (label of labels(); track $index) {
          <span class="truncate px-1">{{ label }}</span>
        }
      </div>
    </div>
  `,
  styles: []
})
export class ProgressChartComponent {
  data = input<number[]>([]);
  labels = input<string[]>([]);
  title = input<string>('');

  count = computed(() => this.data().length);

  normalizedData = computed(() => {
    const values = this.data();
    if (values.length === 0) return [];
    
    // Normalize values to 0-100% height relative to max value
    const max = Math.max(...values, 10); // Minimum scale of 10
    return values.map(v => ({
      value: (v / max) * 100,
      original: v
    }));
  });
}
