import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UiIconComponent } from '../../../../shared/ui/ui-icon/ui-icon.component';
import { MUSCLE_GROUPS, EQUIPMENT_OPTIONS } from '../../constants/admin-exercises.constants';

@Component({
  selector: 'app-exercise-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiIconComponent],
  template: `
    <!-- Backdrop -->
    <button type="button" class="fixed inset-0 z-[100] w-full h-full bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 cursor-default"
    (click)="close.emit()" aria-label="Cerrar modal"></button>

    <!-- Sheet Container -->
    <div class="fixed inset-y-0 right-0 z-[110] w-full sm:w-[450px] bg-background border-l border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">

      <!-- Sheet Header -->
      <div class="flex-none flex items-center justify-between p-6 border-b border-zinc-800 bg-surface shadow-sm relative z-10">
        <h2 class="text-xl font-bold tracking-tight text-text-main flex items-center gap-2">
          @if (isEditing()) {
            <app-ui-icon name="pencil" [size]="20"></app-ui-icon> Editar Ejercicio
          } @else {
            <app-ui-icon name="plus" [size]="20"></app-ui-icon> Nuevo Ejercicio
          }
        </h2>
        <button (click)="close.emit()" class="text-text-muted hover:text-text-main transition-colors h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-800 border border-transparent hover:border-zinc-700">
          <span class="text-xl leading-none">&times;</span>
        </button>
      </div>

      <!-- Sheet Body (Scrollable) -->
      <div class="flex-1 overflow-y-auto p-6 custom-scroll">
        <form [formGroup]="form()" (ngSubmit)="save.emit()" class="space-y-6" id="exercise-form">

          <!-- Name -->
          <div>
            <label for="name" class="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Nombre del Ejercicio *</label>
            <input id="name" type="text" formControlName="name"
              class="w-full bg-surface border border-zinc-800 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-colors shadow-inner text-sm">
            @if (form().get('name')?.invalid && form().get('name')?.touched) {
              <p class="text-red-500 text-xs mt-1.5 font-medium">El nombre es requerido.</p>
            }
          </div>

          <!-- Media URLs -->
          <div class="p-4 bg-surface rounded-xl border border-zinc-800 space-y-4">
            <div>
              <label for="imageUrl" class="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Image URL</label>
              <input id="imageUrl" type="text" formControlName="imageUrl"
                class="w-full bg-background border border-zinc-800 rounded-lg px-4 py-2.5 text-text-muted focus:outline-none focus:border-primary transition-colors shadow-inner text-sm">
            </div>
            <div>
              <label for="videoUrl" class="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
                Video URL <span class="text-red-500 text-[9px] border border-red-500/30 bg-red-500/10 px-1 rounded">YouTube</span>
              </label>
              <input id="videoUrl" type="text" formControlName="videoUrl"
                placeholder="https://youtu.be/..."
                class="w-full bg-background border border-zinc-800 rounded-lg px-4 py-2.5 text-text-muted focus:outline-none focus:border-red-500 transition-colors shadow-inner text-sm">
            </div>
          </div>

          <!-- Selects -->
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2 sm:col-span-1">
              <label for="discipline" class="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Disciplina *</label>
              <select id="discipline" formControlName="discipline" class="w-full bg-surface border border-zinc-800 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-colors appearance-none text-sm cursor-pointer shadow-inner">
                <option value="gym">Gym</option>
                <option value="calisthenics">Calisthenics</option>
                <option value="boxing">Boxing</option>
              </select>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label for="muscleGroup" class="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Músculo *</label>
              <select id="muscleGroup" formControlName="muscleGroup" class="w-full bg-surface border border-zinc-800 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-colors appearance-none text-sm cursor-pointer shadow-inner">
                @for (m of muscleGroups; track m) {
                  <option [value]="m">{{ m | titlecase }}</option>
                }
              </select>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label for="type" class="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Tipo *</label>
              <select id="type" formControlName="type" class="w-full bg-surface border border-zinc-800 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-colors appearance-none text-sm cursor-pointer shadow-inner">
                <option value="compound">Compuesto</option>
                <option value="isolated">Aislado</option>
              </select>
            </div>
            <div class="col-span-2 sm:col-span-1">
              <label for="difficulty" class="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Dificultad *</label>
              <select id="difficulty" formControlName="difficulty" class="w-full bg-surface border border-zinc-800 rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-colors appearance-none text-sm cursor-pointer shadow-inner">
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </div>
          </div>

          <!-- Equipment Chips -->
          <div>
            <span class="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-2">Equipamiento (Opcional)</span>
            <div class="flex flex-wrap gap-2 p-4 bg-surface rounded-xl border border-zinc-800">
              @for (item of equipmentOptions; track item) {
                <button type="button"
                  (click)="toggleEq.emit(item)"
                  class="px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border"
                  [ngClass]="equipmentRequired().includes(item) ? 'bg-primary text-black border-primary shadow-[0_0_10px_rgba(204,255,0,0.3)]' : 'bg-background text-text-muted border-zinc-700 hover:border-zinc-500 hover:text-text-main'">
                  {{ item }}
                </button>
              }
            </div>
          </div>

          <!-- Instructions -->
          <div>
            <label for="instructions" class="block text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Instrucciones</label>
            <p class="text-[10px] text-text-muted mb-2">Separa cada paso usando un punto y coma (;)</p>
            <textarea id="instructions" formControlName="instructions" rows="4"
              placeholder="Ajusta el asiento; Tira de la barra; Contrae al máximo"
            class="w-full bg-surface border border-zinc-800 rounded-xl px-4 py-3 text-text-muted focus:outline-none focus:border-primary transition-colors shadow-inner text-sm resize-none"></textarea>
          </div>
        </form>
      </div>

      <!-- Sheet Footer -->
      <div class="flex-none p-5 bg-surface border-t border-zinc-800 flex gap-3 relative z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        <button type="button" (click)="close.emit()"
          class="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-text-main font-bold tracking-widest text-xs uppercase rounded-xl transition-all border border-transparent hover:border-zinc-600">
          Cancelar
        </button>
        <button type="submit" form="exercise-form" [disabled]="form().invalid || isSaving()"
          class="flex-[2] py-3.5 bg-primary text-black font-extrabold tracking-widest text-xs uppercase rounded-xl transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)] disabled:opacity-50 active:scale-95 flex justify-center items-center gap-2">
          @if (isSaving()) {
            <span class="h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
          }
          {{ isSaving() ? 'Guardando...' : (isEditing() ? 'Actualizar' : 'Guardar') }}
        </button>
      </div>
    </div>
  `
})
export class ExerciseFormComponent {
  form = input.required<FormGroup>();
  isEditing = input.required<boolean>();
  isSaving = input.required<boolean>();
  equipmentRequired = input.required<string[]>();

  close = output<void>();
  save = output<void>();
  toggleEq = output<string>();

  muscleGroups = MUSCLE_GROUPS;
  equipmentOptions = EQUIPMENT_OPTIONS;
}
