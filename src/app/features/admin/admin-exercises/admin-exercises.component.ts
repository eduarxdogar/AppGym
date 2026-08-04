import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminExercisesStore } from './store/admin-exercises.store';
import { AdminExercise } from './models/admin-exercises.models';
import { MUSCLE_GROUPS } from './constants/admin-exercises.constants';
import { UiIconComponent } from '../../../shared/ui/ui-icon/ui-icon.component';
import { ExerciseTableComponent } from './ui/exercise-table/exercise-table.component';
import { ExerciseFormComponent } from './ui/exercise-form/exercise-form.component';

@Component({
  selector: 'app-admin-exercises',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    UiIconComponent,
    ExerciseTableComponent,
    ExerciseFormComponent
  ],
  templateUrl: './admin-exercises.component.html',
  providers: [AdminExercisesStore],
})
export class AdminExercisesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  public store = inject(AdminExercisesStore);

  muscleGroups = MUSCLE_GROUPS;
  
  // Local state for the form (could also be pushed to store, but fine here for the Smart component)
  equipmentRequired: string[] = [];
  
  exerciseForm = this.fb.group({
    name: ['', Validators.required],
    discipline: ['gym', Validators.required],
    muscleGroup: ['pecho', Validators.required],
    type: ['compound', Validators.required],
    difficulty: ['intermediate', Validators.required],
    instructions: [''],
    imageUrl: ['assets/default-exercise.png'],
    videoUrl: [''],
  });

  ngOnInit(): void {
    this.store.loadExercises();
  }

  openCreate(): void {
    this.equipmentRequired = [];
    this.exerciseForm.reset({
      discipline: 'gym',
      muscleGroup: 'pecho',
      type: 'compound',
      difficulty: 'intermediate',
      imageUrl: 'assets/default-exercise.png',
      videoUrl: '',
    });
    this.store.openSideSheet('create');
  }

  openEdit(ex: AdminExercise): void {
    this.equipmentRequired = ex.equipmentRequired || [];
    this.exerciseForm.patchValue({
      name: ex.name || '',
      discipline: ex.discipline || 'gym',
      muscleGroup: ex.muscleGroup || 'pecho',
      type: ex.type || 'compound',
      difficulty: ex.difficulty || 'intermediate',
      instructions: Array.isArray(ex.instructions) ? ex.instructions.join('; ') : '',
      imageUrl: ex.imageUrl || 'assets/default-exercise.png',
      videoUrl: ex.videoUrl || '',
    });
    this.store.openSideSheet('edit', ex);
  }

  closeSideSheet(): void {
    this.store.closeSideSheet();
  }

  toggleEquipment(item: string): void {
    if (this.equipmentRequired.includes(item)) {
      this.equipmentRequired = this.equipmentRequired.filter(eq => eq !== item);
    } else {
      this.equipmentRequired.push(item);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      return;
    }

    const formValue = this.exerciseForm.value;
    const instructionsArray = formValue.instructions
      ? formValue.instructions.split(';').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : [];

    const dataToSave: Partial<AdminExercise> = {
      name: formValue.name?.trim(),
      discipline: formValue.discipline ?? 'gym',
      muscleGroup: formValue.muscleGroup ?? 'pecho',
      type: formValue.type ?? 'compound',
      difficulty: formValue.difficulty ?? 'intermediate',
      instructions: instructionsArray,
      imageUrl: formValue.imageUrl?.trim() || 'assets/default-exercise.png',
      videoUrl: formValue.videoUrl?.trim() || '',
    };

    await this.store.saveExercise(dataToSave, this.equipmentRequired);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
