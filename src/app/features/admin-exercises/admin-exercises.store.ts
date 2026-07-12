import { Injectable, inject, signal, computed } from '@angular/core';
import { AdminExercisesApi } from './admin-exercises.api';
import { ToastService } from '../../core/services/toast.service';

@Injectable()
export class AdminExercisesStore {
  private api = inject(AdminExercisesApi);
  private toastService = inject(ToastService);

  // States
  isSaving = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isSideSheetOpen = signal<boolean>(false);
  editingExerciseId = signal<string | null>(null);
  
  exercisesList = signal<any[]>([]);
  
  // Filters
  searchQuery = signal<string>('');
  filterMuscle = signal<string>('');
  filterDiscipline = signal<string>('');

  // Computed Filters
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

  async loadExercises() {
    try {
      this.isLoading.set(true);
      const list = await this.api.getExercises();
      list.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      this.exercisesList.set(list);
    } catch (e) {
      console.error('Error loading exercises:', e);
      this.toastService.showError('Error al cargar catálogo');
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveExercise(dataToSave: any, equipmentRequired: string[]) {
    this.isSaving.set(true);
    try {
      const currentId = this.editingExerciseId();
      
      const payload = {
          ...dataToSave,
          equipmentRequired
      };

      if (currentId) {
        await this.api.updateExercise(currentId, payload);
        this.toastService.showSuccess('¡Ejercicio actualizado con éxito!');
      } else {
        const docId = this.generateDocId(payload.name || '');
        await this.api.createExercise(docId, payload);
        this.toastService.showSuccess('¡Ejercicio guardado con éxito!');
      }
      this.closeSideSheet();
      await this.loadExercises();
    } catch (error) {
      console.error('ERROR AL GUARDAR:', error);
      this.toastService.showError('Error al guardar: Revisa la consola');
    } finally {
      this.isSaving.set(false);
    }
  }

  private generateDocId(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9\s-]/g, '') // remove special chars
      .trim()
      .replace(/\s+/g, '-');
  }

  openSideSheet(mode: 'create' | 'edit', ex?: any) {
    if (mode === 'edit' && ex) {
      this.editingExerciseId.set(ex.id);
    } else {
      this.editingExerciseId.set(null);
    }
    this.isSideSheetOpen.set(true);
  }

  closeSideSheet() {
    this.isSideSheetOpen.set(false);
  }
}
