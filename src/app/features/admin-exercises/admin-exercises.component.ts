import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-exercises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-[#0B0E14] text-white p-6 pb-24">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center justify-between mb-8">
          <h1 class="text-3xl font-bold tracking-tight">Admin: Añadir Ejercicio</h1>
          <button (click)="goBack()" class="text-zinc-400 hover:text-white transition-colors">Volver</button>
        </div>

        <form [formGroup]="exerciseForm" (ngSubmit)="onSubmit()" class="space-y-6">
          
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1">Nombre del Ejercicio *</label>
            <input type="text" formControlName="name" 
                   class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors">
            <p *ngIf="exerciseForm.get('name')?.invalid && exerciseForm.get('name')?.touched" class="text-red-500 text-xs mt-1">El nombre es requerido.</p>
          </div>

          <!-- Media URLs -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">Image URL</label>
              <input type="text" formControlName="imageUrl" 
                     class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors">
            </div>
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">Video URL</label>
              <input type="text" formControlName="videoUrl" 
                     class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors">
            </div>
          </div>

          <!-- Selects -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">Disciplina *</label>
              <select formControlName="discipline" class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none">
                <option value="gym">Gym</option>
                <option value="calisthenics">Calisthenics</option>
                <option value="boxing">Boxing</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">Grupo Muscular *</label>
              <select formControlName="muscleGroup" class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none">
                <option *ngFor="let m of muscleGroups" [value]="m">{{ m }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">Tipo *</label>
              <select formControlName="type" class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none">
                <option value="compound">Compuesto (Compound)</option>
                <option value="isolated">Aislado (Isolated)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-zinc-400 mb-1">Dificultad *</label>
              <select formControlName="difficulty" class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none">
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </div>
          </div>

          <!-- Equipment Chips -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-2">Equipamiento Requerido</label>
            <div class="flex flex-wrap gap-2">
              <button type="button" *ngFor="let item of equipmentOptions" 
                      (click)="toggleEquipment(item)"
                      class="px-4 py-2 rounded-full text-xs font-bold transition-all border"
                      [ngClass]="equipmentRequired.includes(item) ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_10px_rgba(204,255,0,0.3)]' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-[#CCFF00]'">
                {{ item }}
              </button>
            </div>
          </div>

          <!-- Instructions -->
          <div>
            <label class="block text-sm font-medium text-zinc-400 mb-1">Instrucciones (separadas por punto y coma ';')</label>
            <textarea formControlName="instructions" rows="3"
                      placeholder="Ej: Ajusta el asiento; Tira de la barra; Contrae al máximo"
                      class="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors"></textarea>
          </div>

          <!-- Submit -->
          <button type="submit" [disabled]="exerciseForm.invalid || isSaving"
                  class="w-full py-4 bg-[#CCFF00] hover:bg-[#bce600] text-black font-bold tracking-widest uppercase rounded-xl transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)] disabled:opacity-50">
            {{ isSaving ? 'Guardando...' : 'Registrar Ejercicio' }}
          </button>

        </form>
      </div>
    </div>
  `
})
export class AdminExercisesComponent {
  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private router = inject(Router);

  isSaving = false;

  muscleGroups = ['pecho', 'espalda', 'hombros', 'bíceps', 'tríceps', 'cuádriceps', 'isquios', 'glúteos', 'gemelos', 'core'];
  equipmentOptions = ['Polea', 'Máquina Smith', 'Máquinas', 'Mancuernas', 'Barra', 'Kettlebells', 'Bandas', 'Calistenia'];

  exerciseForm = this.fb.group({
    name: ['', Validators.required],
    discipline: ['gym', Validators.required],
    muscleGroup: ['pecho', Validators.required],
    type: ['compound', Validators.required],
    difficulty: ['intermediate', Validators.required],
    instructions: [''],
    imageUrl: ['assets/default-exercise.png'],
    videoUrl: ['']
  });

  equipmentRequired: string[] = [];

  toggleEquipment(item: string) {
    if (this.equipmentRequired.includes(item)) {
      this.equipmentRequired = this.equipmentRequired.filter(eq => eq !== item);
    } else {
      this.equipmentRequired.push(item);
    }
  }

  generateDocId(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9\s-]/g, '') // remove special chars
      .trim()
      .replace(/\s+/g, '-');
  }

  async onSubmit() {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formValue = this.exerciseForm.value;

    const instructionsArray = formValue.instructions 
      ? formValue.instructions.split(';').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    const dataToSave = {
      name: formValue.name?.trim(),
      discipline: formValue.discipline,
      muscleGroup: formValue.muscleGroup,
      type: formValue.type,
      difficulty: formValue.difficulty,
      instructions: instructionsArray,
      equipmentRequired: this.equipmentRequired,
      imageUrl: formValue.imageUrl?.trim() || 'assets/default-exercise.png',
      videoUrl: formValue.videoUrl?.trim() || ''
    };

    const docId = this.generateDocId(dataToSave.name || '');

    try {
      const ref = doc(this.firestore, `global_exercises/${docId}`);
      await setDoc(ref, dataToSave);
      
      alert('¡Ejercicio guardado con éxito!');
      
      // Reset form but keep default image url and equipment empty
      this.exerciseForm.reset({
        discipline: 'gym',
        muscleGroup: 'pecho',
        type: 'compound',
        difficulty: 'intermediate',
        imageUrl: 'assets/default-exercise.png',
        videoUrl: ''
      });
      this.equipmentRequired = [];
      
    } catch (error) {
      console.error('Error saving exercise:', error);
      alert('Error al guardar el ejercicio.');
    } finally {
      this.isSaving = false;
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
