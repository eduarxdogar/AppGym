import { Injectable, inject, signal, computed } from '@angular/core';
import { AdminExercisesQueries } from '../api/admin-exercises.queries';
import { AdminExercisesCommands } from '../api/admin-exercises.commands';
import { AdminExercise } from '../models/admin-exercises.models';
import { ToastService } from '../../../../core/services/toast.service';

@Injectable()
export class AdminExercisesStore {
  private readonly queries = inject(AdminExercisesQueries);
  private readonly commands = inject(AdminExercisesCommands);
  private readonly toastService = inject(ToastService);

  // States
  isSaving = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  isSideSheetOpen = signal<boolean>(false);
  editingExerciseId = signal<string | null>(null);

  exercisesList = signal<AdminExercise[]>([]);

  // Filters
  searchQuery = signal<string>('');
  filterMuscle = signal<string>('');
  filterDiscipline = signal<string>('');

  // Computed Filters
  filteredExercises = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const muscle = this.filterMuscle();
    const discipline = this.filterDiscipline();

    return this.exercisesList().filter((ex) => {
      const matchName = !query || ex.name?.toLowerCase().includes(query);
      const matchMuscle = !muscle || ex.muscleGroup === muscle;
      const matchDiscipline = !discipline || ex.discipline === discipline;
      return matchName && matchMuscle && matchDiscipline;
    });
  });

  async loadExercises(): Promise<void> {
    try {
      this.isLoading.set(true);
      const list = await this.queries.getExercises();
      list.sort((a: AdminExercise, b: AdminExercise) => 
        (a.name || '').localeCompare(b.name || '')
      );
      this.exercisesList.set(list);
    } catch (e) {
      console.error('Error loading exercises:', e);
      this.toastService.showError('Error al cargar catálogo');
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveExercise(dataToSave: Partial<AdminExercise>, equipmentRequired: string[]): Promise<void> {
    this.isSaving.set(true);
    try {
      const currentId = this.editingExerciseId();

      const payload: Partial<AdminExercise> = {
        ...dataToSave,
        equipmentRequired,
      };

      if (currentId) {
        await this.commands.updateExercise(currentId, payload);
        this.toastService.showSuccess('¡Ejercicio actualizado con éxito!');
      } else {
        const docId = this.generateDocId(payload.name || '');
        await this.commands.createExercise(docId, payload);
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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9\s-]/g, '') // remove special chars
      .trim()
      .replace(/\s+/g, '-');
  }

  openSideSheet(mode: 'create' | 'edit', ex?: AdminExercise): void {
    if (mode === 'edit' && ex) {
      this.editingExerciseId.set(ex.id || null);
    } else {
      this.editingExerciseId.set(null);
    }
    this.isSideSheetOpen.set(true);
  }

  closeSideSheet(): void {
    this.isSideSheetOpen.set(false);
  }
}
