import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { Firestore, doc, setDoc, updateDoc, collection, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-exercises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[#0B0E14] text-white p-4 md:p-6 pb-24 relative overflow-x-hidden animate-fadeIn">
      <div class="max-w-7xl mx-auto space-y-6">
        
        <!-- Header & Action Bar -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#151921] p-5 rounded-2xl border border-zinc-800 shadow-xl">
          <div class="flex items-center gap-4">
             <button (click)="goBack()" class="text-zinc-400 hover:text-white transition-colors p-2 bg-zinc-900 rounded-lg border border-zinc-700 hover:border-zinc-500 flex items-center justify-center">
               <span class="text-xs font-bold uppercase tracking-widest">Volver</span>
             </button>
             <div>
                 <h1 class="text-2xl md:text-3xl font-bold tracking-tight text-white leading-none">Catálogo</h1>
                 <p class="text-xs text-zinc-500 uppercase tracking-widest mt-1">{{ filteredExercises().length }} ejercicios de {{ exercisesList().length }}</p>
             </div>
          </div>

          <div class="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <!-- Search -->
            <div class="relative w-full sm:w-64">
                <input type="search" placeholder="Buscar por nombre..."
                       [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
                       class="w-full bg-[#0B0E14] border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#CCFF00] transition-colors shadow-inner">
            </div>
            
            <!-- Filters -->
            <select [ngModel]="filterMuscle()" (ngModelChange)="filterMuscle.set($event)"
                    class="w-full sm:w-auto bg-[#0B0E14] border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#CCFF00] appearance-none cursor-pointer">
              <option value="">Músculo (Todos)</option>
              <option *ngFor="let m of muscleGroups" [value]="m">{{ m | titlecase }}</option>
            </select>
            
            <select [ngModel]="filterDiscipline()" (ngModelChange)="filterDiscipline.set($event)"
                    class="w-full sm:w-auto bg-[#0B0E14] border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#CCFF00] appearance-none cursor-pointer">
              <option value="">Disciplina (Todas)</option>
              <option value="gym">Gym</option>
              <option value="calisthenics">Calisthenics</option>
              <option value="boxing">Boxing</option>
            </select>

            <button (click)="openSideSheet('create')" 
                    class="w-full sm:w-auto px-6 py-2.5 bg-[#CCFF00] hover:bg-[#bce600] text-black font-bold text-sm tracking-wider uppercase rounded-xl transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)] whitespace-nowrap active:scale-95">
              + Nuevo
            </button>
          </div>
        </div>

        <!-- Exercises Grid Master -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (ex of filteredExercises(); track ex.id) {
            <div class="bg-[#151921] border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between group hover:border-zinc-600 transition-all shadow-sm hover:shadow-lg">
              <div class="flex items-start gap-4 mb-4">
                <div class="h-16 w-16 rounded-xl bg-zinc-800 overflow-hidden relative border border-zinc-700 flex-shrink-0 shadow-inner">
                    <img [src]="ex.imageUrl || 'assets/default-exercise.png'" alt="Exercise" class="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                         (error)="$any($event.target).src='assets/default-exercise.png'">
                </div>
                <div class="flex-1 min-w-0 pt-1">
                  <h4 class="text-white font-bold text-sm leading-tight truncate" [title]="ex.name">{{ ex.name }}</h4>
                  <div class="flex gap-1.5 mt-2 flex-wrap">
                     <span class="px-2 py-0.5 bg-zinc-800/80 border border-zinc-700 rounded text-[9px] uppercase tracking-widest text-zinc-400">
                       {{ ex.muscleGroup }}
                     </span>
                     <span *ngIf="ex.videoUrl" class="px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-[9px] uppercase tracking-widest text-red-500 font-bold" title="Tiene Video de YouTube">
                       Video
                     </span>
                  </div>
                </div>
              </div>
              <div class="flex justify-end pt-3 border-t border-zinc-800/50">
                <button (click)="openSideSheet('edit', ex)" class="text-zinc-500 hover:text-[#CCFF00] bg-zinc-900/50 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-transparent hover:border-zinc-700 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2">
                  Editar <span class="text-[12px]">✏️</span>
                </button>
              </div>
            </div>
          } @empty {
             <div class="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500 bg-[#151921] rounded-2xl border border-zinc-800 border-dashed">
                <div class="text-5xl mb-4 opacity-50">🔍</div>
                <p class="font-medium tracking-wide">No se encontraron ejercicios que coincidan con los filtros.</p>
                <button (click)="searchQuery.set(''); filterMuscle.set(''); filterDiscipline.set('')" class="mt-4 text-[#CCFF00] hover:underline text-xs uppercase tracking-widest font-bold">Limpiar Filtros</button>
             </div>
          }
        </div>
      </div>

      <!-- SIDE SHEET (Detail Overlay) -->
      @if (isSideSheetOpen()) {
        <!-- Backdrop -->
        <div class="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
             (click)="closeSideSheet()"></div>
        
        <!-- Sheet Container -->
        <div class="fixed inset-y-0 right-0 z-[110] w-full sm:w-[450px] bg-[#0B0E14] border-l border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
           
           <!-- Sheet Header -->
           <div class="flex-none flex items-center justify-between p-6 border-b border-zinc-800 bg-[#151921] shadow-sm relative z-10">
              <h2 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                 <span class="text-xl">{{ editingExerciseId ? '✏️' : '✨' }}</span>
                 {{ editingExerciseId ? 'Editar Ejercicio' : 'Nuevo Ejercicio' }}
              </h2>
              <button (click)="closeSideSheet()" class="text-zinc-500 hover:text-white transition-colors h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-800 border border-transparent hover:border-zinc-700">
                <span class="text-xl leading-none">&times;</span>
              </button>
           </div>

           <!-- Sheet Body (Scrollable) -->
           <div class="flex-1 overflow-y-auto p-6 custom-scroll">
              <form [formGroup]="exerciseForm" (ngSubmit)="onSubmit()" class="space-y-6" id="exercise-form">
                
                <!-- Name -->
                <div>
                  <label class="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Nombre del Ejercicio *</label>
                  <input type="text" formControlName="name" 
                         class="w-full bg-[#151921] border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors shadow-inner text-sm">
                  <p *ngIf="exerciseForm.get('name')?.invalid && exerciseForm.get('name')?.touched" class="text-red-500 text-xs mt-1.5 font-medium">El nombre es requerido.</p>
                </div>

                <!-- Media URLs -->
                <div class="p-4 bg-[#151921] rounded-xl border border-zinc-800 space-y-4">
                  <div>
                    <label class="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Image URL</label>
                    <input type="text" formControlName="imageUrl" 
                           class="w-full bg-[#0B0E14] border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-300 focus:outline-none focus:border-[#CCFF00] transition-colors shadow-inner text-sm">
                  </div>
                  <div>
                    <label class="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                       Video URL <span class="text-red-500 text-[9px] border border-red-500/30 bg-red-500/10 px-1 rounded">YouTube</span>
                    </label>
                    <input type="text" formControlName="videoUrl" 
                           placeholder="https://youtu.be/..."
                           class="w-full bg-[#0B0E14] border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-300 focus:outline-none focus:border-red-500 transition-colors shadow-inner text-sm">
                  </div>
                </div>

                <!-- Selects -->
                <div class="grid grid-cols-2 gap-4">
                  <div class="col-span-2 sm:col-span-1">
                    <label class="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Disciplina *</label>
                    <select formControlName="discipline" class="w-full bg-[#151921] border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none text-sm cursor-pointer shadow-inner">
                      <option value="gym">Gym</option>
                      <option value="calisthenics">Calisthenics</option>
                      <option value="boxing">Boxing</option>
                    </select>
                  </div>
                  <div class="col-span-2 sm:col-span-1">
                    <label class="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Músculo *</label>
                    <select formControlName="muscleGroup" class="w-full bg-[#151921] border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none text-sm cursor-pointer shadow-inner">
                      <option *ngFor="let m of muscleGroups" [value]="m">{{ m | titlecase }}</option>
                    </select>
                  </div>
                  <div class="col-span-2 sm:col-span-1">
                    <label class="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Tipo *</label>
                    <select formControlName="type" class="w-full bg-[#151921] border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none text-sm cursor-pointer shadow-inner">
                      <option value="compound">Compuesto</option>
                      <option value="isolated">Aislado</option>
                    </select>
                  </div>
                  <div class="col-span-2 sm:col-span-1">
                    <label class="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Dificultad *</label>
                    <select formControlName="difficulty" class="w-full bg-[#151921] border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#CCFF00] transition-colors appearance-none text-sm cursor-pointer shadow-inner">
                      <option value="beginner">Principiante</option>
                      <option value="intermediate">Intermedio</option>
                      <option value="advanced">Avanzado</option>
                    </select>
                  </div>
                </div>

                <!-- Equipment Chips -->
                <div>
                  <label class="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Equipamiento (Opcional)</label>
                  <div class="flex flex-wrap gap-2 p-4 bg-[#151921] rounded-xl border border-zinc-800">
                    <button type="button" *ngFor="let item of equipmentOptions" 
                            (click)="toggleEquipment(item)"
                            class="px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border"
                            [ngClass]="equipmentRequired.includes(item) ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_10px_rgba(204,255,0,0.3)]' : 'bg-[#0B0E14] text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'">
                      {{ item }}
                    </button>
                  </div>
                </div>

                <!-- Instructions -->
                <div>
                  <label class="block text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Instrucciones</label>
                  <p class="text-[10px] text-zinc-500 mb-2">Separa cada paso usando un punto y coma (;)</p>
                  <textarea formControlName="instructions" rows="4"
                            placeholder="Ajusta el asiento; Tira de la barra; Contrae al máximo"
                            class="w-full bg-[#151921] border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 focus:outline-none focus:border-[#CCFF00] transition-colors shadow-inner text-sm resize-none"></textarea>
                </div>
              </form>
           </div>

           <!-- Sheet Footer -->
           <div class="flex-none p-5 bg-[#151921] border-t border-zinc-800 flex gap-3 relative z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
              <button type="button" (click)="closeSideSheet()"
                      class="flex-1 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold tracking-widest text-xs uppercase rounded-xl transition-all border border-transparent hover:border-zinc-600">
                Cancelar
              </button>
              <button type="submit" form="exercise-form" [disabled]="exerciseForm.invalid || isSaving"
                      class="flex-[2] py-3.5 bg-[#CCFF00] hover:bg-[#bce600] text-black font-extrabold tracking-widest text-xs uppercase rounded-xl transition-all shadow-[0_0_15px_rgba(204,255,0,0.2)] disabled:opacity-50 active:scale-95 flex justify-center items-center gap-2">
                <span *ngIf="isSaving" class="h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin"></span>
                {{ isSaving ? 'Guardando...' : (editingExerciseId ? 'Actualizar' : 'Guardar') }}
              </button>
           </div>
        </div>
      }
    </div>
  `
})
export class AdminExercisesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private toastService = inject(ToastService);

  // States
  isSaving = false;
  isSideSheetOpen = signal(false);
  editingExerciseId: string | null = null;
  
  exercisesList = signal<any[]>([]);
  
  // Filters
  searchQuery = signal('');
  filterMuscle = signal('');
  filterDiscipline = signal('');

  // Computed Filtered List
  filteredExercises = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const muscle = this.filterMuscle();
    const discipline = this.filterDiscipline();

    return this.exercisesList().filter(ex => {
      const matchName = !query || ex.name?.toLowerCase().includes(query);
      const matchMuscle = !muscle || ex.muscleGroup === muscle;
      const matchDiscipline = !discipline || ex.discipline === discipline;
      return matchName && matchMuscle && matchDiscipline;
    });
  });

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
      list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      this.exercisesList.set(list);
    } catch (e) {
      console.error('Error loading exercises:', e);
      this.toastService.showError('Error al cargar catálogo');
    }
  }

  openSideSheet(mode: 'create' | 'edit', ex?: any) {
    if (mode === 'edit' && ex) {
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
    } else {
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
    this.isSideSheetOpen.set(true);
  }

  closeSideSheet() {
    this.isSideSheetOpen.set(false);
    setTimeout(() => {
      this.editingExerciseId = null;
      this.equipmentRequired = [];
      this.exerciseForm.reset();
    }, 300); // Wait for transition
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
      
      this.closeSideSheet();
      await this.loadExercises();
      
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
