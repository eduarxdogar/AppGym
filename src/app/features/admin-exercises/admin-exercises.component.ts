import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Firestore, doc, setDoc, updateDoc, collection, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';

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

          <!-- Submit & Cancel -->
          <div class="flex gap-4">
            <button *ngIf="editingExerciseId" type="button" (click)="cancelEdit()"
                    class="w-1/3 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold tracking-widest uppercase rounded-xl transition-all">
              Cancelar
            </button>
            <button type="submit" [disabled]="exerciseForm.invalid || isSaving"
                    class="flex-1 py-4 bg-[#CCFF00] hover:bg-[#bce600] text-black font-bold tracking-widest uppercase rounded-xl transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)] disabled:opacity-50">
              {{ isSaving ? 'Guardando...' : (editingExerciseId ? 'Actualizar Ejercicio' : 'Registrar Ejercicio') }}
            </button>
          </div>

        </form>

        <!-- Exercises List -->
        <hr class="border-zinc-800 my-10">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold tracking-tight text-white">Catálogo Actual</h2>
          <span class="text-zinc-500 text-sm font-medium">{{ exercisesList().length }} ejercicios</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (ex of exercisesList(); track ex.id) {
            <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between group hover:border-[#CCFF00]/50 transition-colors">
              <div class="flex items-center gap-4">
                <div class="h-12 w-12 rounded-lg bg-zinc-800 overflow-hidden relative border border-zinc-700 flex-shrink-0">
                    <img [src]="ex.imageUrl || 'assets/default-exercise.png'" alt="Exercise" class="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                         (error)="$any($event.target).src='assets/default-exercise.png'">
                </div>
                <div>
                  <h4 class="text-white font-bold text-sm leading-tight truncate w-32 sm:w-48">{{ ex.name }}</h4>
                  <p class="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">{{ ex.muscleGroup }}</p>
                </div>
              </div>
              <button (click)="editExercise(ex)" class="text-zinc-500 hover:text-[#CCFF00] p-2 bg-zinc-900 rounded-lg border border-zinc-800 transition-colors flex-shrink-0 flex items-center justify-center">
                ✏️
              </button>
            </div>
          }
        </div>

      </div>
    </div>
  `
})
export class AdminExercisesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private toastService = inject(ToastService);

  isSaving = false;
  editingExerciseId: string | null = null;
  exercisesList = signal<any[]>([]);

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

  ngOnInit() {
    this.loadExercises();
  }

  async loadExercises() {
    try {
      const colRef = collection(this.firestore, 'global_exercises');
      const snapshot = await getDocs(colRef);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort alphabetically by name
      list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      this.exercisesList.set(list);
    } catch (e) {
      console.error('Error loading exercises:', e);
      this.toastService.showError('Error al cargar catálogo');
    }
  }

  editExercise(ex: any) {
    this.editingExerciseId = ex.id;
    this.equipmentRequired = ex.equipmentRequired || [];
    this.exerciseForm.patchValue({
      name: ex.name,
      discipline: ex.discipline || 'gym',
      muscleGroup: ex.muscleGroup || 'pecho',
      type: ex.type || 'compound',
      difficulty: ex.difficulty || 'intermediate',
      instructions: Array.isArray(ex.instructions) ? ex.instructions.join('; ') : '',
      imageUrl: ex.imageUrl || 'assets/default-exercise.png',
      videoUrl: ex.videoUrl || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editingExerciseId = null;
    this.equipmentRequired = [];
    this.exerciseForm.reset({
      discipline: 'gym',
      muscleGroup: 'pecho',
      type: 'compound',
      difficulty: 'intermediate',
      imageUrl: 'assets/default-exercise.png',
      videoUrl: ''
    });
  }

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

    try {
      if (this.editingExerciseId) {
        const ref = doc(this.firestore, `global_exercises/${this.editingExerciseId}`);
        await updateDoc(ref, dataToSave);
        this.toastService.showSuccess('¡Ejercicio actualizado con éxito!');
      } else {
        const docId = this.generateDocId(dataToSave.name || '');
        const ref = doc(this.firestore, `global_exercises/${docId}`);
        await setDoc(ref, dataToSave);
        this.toastService.showSuccess('¡Ejercicio guardado con éxito!');
      }
      
      this.cancelEdit();
      this.loadExercises();
      
    } catch (error) {
      console.error('Error saving exercise:', error);
      this.toastService.showError('Error al guardar el ejercicio.');
    } finally {
      this.isSaving = false;
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
