import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'muscleColor',
  standalone: true
})
export class MuscleColorPipe implements PipeTransform {
  transform(percent: number): string {
    if (percent <= 30) return 'text-red-500';
    if (percent <= 75) return 'text-yellow-500';
    return 'text-green-500';
  }
}
