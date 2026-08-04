import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Ejercicio } from '../../../../../core/models/ejercicio.model';
import { ExerciseImageService } from '../../../../../core/services/exercise-image.service';

@Component({
  selector: 'app-exercise-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, CdkDragHandle],
  templateUrl: './exercise-card.component.html'
})
export class ExerciseCardComponent {
  ex = input.required<Ejercicio>();
  exIndex = input.required<number>();
  
  exerciseImgService = inject(ExerciseImageService);
  
  openDetail = output<Ejercicio>();
  delete = output<number>();
  
  updateSupersetField = output<{exIndex: number, field: 'series' | 'repeticiones', value: number}>();
  unlinkSuperset = output<{exIndex: number, event: Event}>();
}
