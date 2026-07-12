import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AdminExercisesStore } from './store/admin-exercises.store';
import { AdminExercise } from './services/admin-exercises.api';

@Component({
  selector: 'app-admin-exercises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-exercises.component.html',
  providers: [AdminExercisesStore],
})
export class AdminExercisesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  public store = inject(AdminExercisesStore);

  muscleGroups = [
    'pecho',
    'espalda',
    'hombros',
    'bíceps',
    'tríceps',
    'cuádriceps',
    'isquios',
    'glúteos',
    'gemelos',
    'core',
  ];
  equipmentOptions = [
    'Polea',
    'Máquina Smith',
    'Máquinas',
    'Mancuernas',
    'Barra',
    'Kettlebells',
    'Bandas',
    'Calistenia',
  ];

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

  equipmentRequired: string[] = [];

  ngOnInit(): void {
    this.store.loadExercises();
  }

  openSideSheet(mode: 'create' | 'edit', ex?: AdminExercise): void {
    this.store.openSideSheet(mode, ex);
    if (mode === 'edit' && ex) {
      this.equipmentRequired = ex.equipmentRequired || [];
      this.exerciseForm.patchValue({
        name: ex.name || '',
        discipline: ex.discipline || 'gym',
        muscleGroup: ex.muscleGroup || 'pecho',
        type: ex.type || 'compound',
        difficulty: ex.difficulty || 'intermediate',
        instructions: Array.isArray(ex.instructions)
          ? ex.instructions.join('; ')
          : '',
        imageUrl: ex.imageUrl || 'assets/default-exercise.png',
        videoUrl: ex.videoUrl || '',
      });
    } else {
      this.equipmentRequired = [];
      this.exerciseForm.reset({
        discipline: 'gym',
        muscleGroup: 'pecho',
        type: 'compound',
        difficulty: 'intermediate',
        imageUrl: 'assets/default-exercise.png',
        videoUrl: '',
      });
    }
  }

  closeSideSheet(): void {
    this.store.closeSideSheet();
    setTimeout(() => {
      this.equipmentRequired = [];
      this.exerciseForm.reset({
        discipline: 'gym',
        muscleGroup: 'pecho',
        type: 'compound',
        difficulty: 'intermediate',
        imageUrl: 'assets/default-exercise.png',
        videoUrl: '',
      });
    }, 300); // Wait for transition
  }

  toggleEquipment(item: string): void {
    if (this.equipmentRequired.includes(item)) {
      this.equipmentRequired = this.equipmentRequired.filter(
        (eq) => eq !== item,
      );
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
      ? formValue.instructions
          .split(';')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
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
