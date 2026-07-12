import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminExercisesStore } from './admin-exercises.store';

@Component({
  selector: 'app-admin-exercises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-exercises.component.html',
  providers: [AdminExercisesStore]
})
export class AdminExercisesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  public store = inject(AdminExercisesStore);

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
    this.store.loadExercises();
  }

  openSideSheet(mode: 'create' | 'edit', ex?: any) {
    this.store.openSideSheet(mode, ex);
    if (mode === 'edit' && ex) {
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
  }

  closeSideSheet() {
    this.store.closeSideSheet();
    setTimeout(() => {
      this.equipmentRequired = [];
      this.exerciseForm.reset({
        discipline: 'gym',
        muscleGroup: 'pecho',
        type: 'compound',
        difficulty: 'intermediate',
        imageUrl: 'assets/default-exercise.png',
        videoUrl: ''
      });
    }, 300); // Wait for transition
  }

  toggleEquipment(item: string) {
    if (this.equipmentRequired.includes(item)) {
      this.equipmentRequired = this.equipmentRequired.filter(eq => eq !== item);
    } else {
      this.equipmentRequired.push(item);
    }
  }

  async onSubmit() {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      return;
    }

    const formValue = this.exerciseForm.value;

    const instructionsArray = formValue.instructions
      ? formValue.instructions.split(';').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : [];

    const dataToSave = {
      name: formValue.name?.trim(),
      discipline: formValue.discipline,
      muscleGroup: formValue.muscleGroup,
      type: formValue.type,
      difficulty: formValue.difficulty,
      instructions: instructionsArray,
      imageUrl: formValue.imageUrl?.trim() || 'assets/default-exercise.png',
      videoUrl: formValue.videoUrl?.trim() || ''
    };

    await this.store.saveExercise(dataToSave, this.equipmentRequired);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
