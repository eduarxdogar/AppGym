import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // 👈 aquí
import { ExerciseService } from '../../core/services/exercise.service';
import { Ejercicio } from '../../models/workout.model';

@Component({
  selector: 'app-exercise-selector',
  standalone: true,
  imports: [CommonModule, FormsModule], // 👈 aquí
  templateUrl: './exercise-selector.component.html',
})
export class ExerciseSelectorComponent {
  grupos: string[] = [
    'pecho',
    'espalda',
    'piernas',
    'hombros',
    'bíceps',
    'tríceps',
    'core',
    'otros',
  ];
  selectedGroup = 'pecho';
  ejercicios: Ejercicio[] = [];

  @Output() ejercicioSeleccionado = new EventEmitter<Ejercicio>();

  constructor(private exerciseService: ExerciseService) {
    this.filtrar();
  }

  filtrar() {
    this.ejercicios = this.exerciseService.getByGroup(this.selectedGroup);
  }

  seleccionar(ejercicio: Ejercicio) {
    this.ejercicioSeleccionado.emit(ejercicio);
  }
}
