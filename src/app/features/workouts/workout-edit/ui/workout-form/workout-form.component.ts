import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { UiCardComponent } from '../../../../../shared/ui/ui-card/ui-card.component';
import { UiButtonComponent } from '../../../../../shared/ui/ui-button/ui-button.component';
import { Ejercicio } from '../../../../../core/models/ejercicio.model';

@Component({
  selector: 'app-workout-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, UiCardComponent, UiButtonComponent],
  template: `
    <app-ui-card [title]="editingExerciseIndex() !== null ? 'Editar Ejercicio' : 'Nuevo Ejercicio'"
      customClass="bg-zinc-900 border border-zinc-700 shadow-2xl relative overflow-hidden">
      <!-- Neon glow visual -->
      <div class="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] pointer-events-none"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
        <div class="md:col-span-2">
          <label for="nombreEjercicio" class="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1 block">Nombre del Ejercicio</label>
          <input id="nombreEjercicio" type="text" [ngModel]="newExercise().nombre"
            (ngModelChange)="updateField('nombre', $event)" placeholder="Ej: Press Banca"
            class="w-full bg-black border border-zinc-700 focus:border-primary text-white rounded-lg h-12 px-4 transition-colors outline-none placeholder-zinc-700">
        </div>
        <div>
          <label for="grupoMuscular" class="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1 block">Grupo Muscular</label>
          <select id="grupoMuscular" [ngModel]="newExercise().grupoMuscular"
            (ngModelChange)="updateField('grupoMuscular', $event)"
            class="w-full bg-black border border-zinc-700 focus:border-primary text-white rounded-lg h-12 px-4 transition-colors outline-none appearance-none">
            @for (grupo of grupoMuscularOpciones(); track grupo) {
              <option [value]="grupo">{{ grupo | titlecase }}</option>
            }
          </select>
        </div>
        <div>
          <label for="tipoEjercicio" class="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1 block">Tipo</label>
          <select id="tipoEjercicio" [ngModel]="newExercise().tipo" (ngModelChange)="updateField('tipo', $event)"
            class="w-full bg-black border border-zinc-700 focus:border-primary text-white rounded-lg h-12 px-4 transition-colors outline-none appearance-none">
            <option value="compuesto">Compuesto</option>
            <option value="aislado">Aislado</option>
          </select>
        </div>
        <div>
          <label for="seriesEjercicio" class="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1 block">Series</label>
          <input id="seriesEjercicio" type="number" [ngModel]="newExercise().series"
            (ngModelChange)="updateField('series', $event)"
            class="w-full bg-black border border-zinc-700 focus:border-primary text-white rounded-lg h-12 px-4 transition-colors outline-none">
        </div>
        <div>
          <label for="repsEjercicio" class="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1 block">Reps</label>
          <input id="repsEjercicio" type="number" [ngModel]="newExercise().repeticiones"
            (ngModelChange)="updateField('repeticiones', $event)"
            class="w-full bg-black border border-zinc-700 focus:border-primary text-white rounded-lg h-12 px-4 transition-colors outline-none">
        </div>
        <div>
          <label for="pesoEjercicio" class="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1 block">Peso (Kg)</label>
          <input id="pesoEjercicio" type="number" [ngModel]="newExercise().pesokg"
            (ngModelChange)="updateField('pesokg', $event)"
            class="w-full bg-black border border-zinc-700 focus:border-primary text-white rounded-lg h-12 px-4 transition-colors outline-none">
        </div>
        <div>
          <label for="descansoEjercicio" class="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1 block">Descanso</label>
          <input id="descansoEjercicio" type="text" [ngModel]="newExercise().descanso"
            (ngModelChange)="updateField('descanso', $event)" placeholder="90s"
            class="w-full bg-black border border-zinc-700 focus:border-primary text-white rounded-lg h-12 px-4 transition-colors outline-none">
        </div>
        <div class="md:col-span-2">
          <label for="videoUrlEjercicio" class="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1 block">URL de YouTube (Video Demo)</label>
          <input id="videoUrlEjercicio" type="text" [ngModel]="newExercise().videoUrl"
            (ngModelChange)="updateField('videoUrl', $event)"
            placeholder="https://www.youtube.com/watch?v=..."
            class="w-full bg-black border border-zinc-700 focus:border-primary text-white rounded-lg h-12 px-4 transition-colors outline-none placeholder-zinc-700">
        </div>
      </div>
      <div class="flex justify-end gap-3 pt-4 border-t border-zinc-800">
        @if (editingExerciseIndex() !== null) {
          <app-ui-button (clicked)="cancelled.emit()" variant="ghost"
            customClass="text-zinc-500 hover:text-white">
            Cancelar
          </app-ui-button>
        }
        <app-ui-button (clicked)="save.emit()" variant="secondary" [disabled]="!newExercise().nombre"
          customClass="bg-white text-black hover:bg-zinc-200 font-bold px-6">
          {{ editingExerciseIndex() !== null ? 'Actualizar Ejercicio' : 'Agregar a la Rutina' }}
        </app-ui-button>
      </div>
    </app-ui-card>
    @if (editingExerciseIndex() !== null) {
      <div class="mt-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
        <p class="text-orange-400 text-sm flex items-center gap-2">
          <mat-icon class="text-sm">edit</mat-icon>
          Estás editando un ejercicio existente.
        </p>
      </div>
    }
  `
})
export class WorkoutFormComponent {
  newExercise = input.required<Ejercicio>();
  editingExerciseIndex = input.required<number | null>();
  grupoMuscularOpciones = input.required<string[]>();
  
  exerciseChange = output<Ejercicio>();
  save = output<void>();
  cancelled = output<void>();

  updateField(field: keyof Ejercicio, value: any): void {
    const updated = { ...this.newExercise(), [field]: value };
    this.exerciseChange.emit(updated as Ejercicio);
  }
}
