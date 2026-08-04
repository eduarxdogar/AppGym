import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Ejercicio } from '../../../../../core/models/ejercicio.model';
import { WorkoutSet } from '../../services/workout-session.service';

@Component({
  selector: 'app-set-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './set-tracker.component.html'
})
export class SetTrackerComponent {
  exIndex = input.required<number>();
  ex = input.required<Ejercicio>();
  sets = input.required<WorkoutSet[]>();
  
  toggleType = output<{exIndex: number, setIndex: number}>();
  toggleSuperset = output<{exIndex: number, setIndex: number}>();
  toggleComplete = output<{exIndex: number, setIndex: number}>();
  deleteSet = output<{exIndex: number, setIndex: number}>();
  
  updateWeight = output<{exIndex: number, setIndex: number, weight: number}>();
  updateReps = output<{exIndex: number, setIndex: number, reps: number}>();
  
  clearSuperset = output<{exIndex: number, setIndex: number}>();
  
  updateDropSet = output<{exIndex: number, setIndex: number, dropIndex: number, weight: number, reps: number}>();
  deleteDropSet = output<{exIndex: number, setIndex: number, dropIndex: number}>();
  clearDropSetSuperset = output<{exIndex: number, setIndex: number, dropIndex: number}>();
  
  addSet = output<number>();
  addDropSet = output<number>();
  openSuperserieModal = output<number>();
}
