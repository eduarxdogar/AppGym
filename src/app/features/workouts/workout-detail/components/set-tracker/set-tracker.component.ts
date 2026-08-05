import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Ejercicio } from '../../../models/ejercicio.model';
import { WorkoutSet } from '../../services/workout-session.service';
import { EditSetDialogComponent } from '../edit-set-dialog/edit-set-dialog.component';

@Component({
  selector: 'app-set-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './set-tracker.component.html'
})
export class SetTrackerComponent {
  private readonly dialog = inject(MatDialog);

  exIndex = input.required<number>();
  ex = input.required<Ejercicio>();
  sets = input.required<WorkoutSet[]>();
  
  toggleType = output<{exIndex: number, setIndex: number}>();
  toggleSuperset = output<{exIndex: number, setIndex: number}>();
  toggleComplete = output<{exIndex: number, setIndex: number}>();
  deleteSet = output<{exIndex: number, setIndex: number}>();
  
  updateWeight = output<{exIndex: number, setIndex: number, weight: number}>();
  updateReps = output<{exIndex: number, setIndex: number, reps: number}>();
  
  clearSuperset = output<{exIndex: number, setIndex: number}>();
  
  updateDropSet = output<{exIndex: number, setIndex: number, dropIndex: number, weight: number, reps: number}>();
  deleteDropSet = output<{exIndex: number, setIndex: number, dropIndex: number}>();
  clearDropSetSuperset = output<{exIndex: number, setIndex: number, dropIndex: number}>();
  
  addSet = output<number>();
  addDropSet = output<number>();
  openSuperserieModal = output<number>();

  markAsIncomplete(exIndex: number, setIndex: number): void {
    const dialogRef = this.dialog.open(EditSetDialogComponent, {
      width: '400px',
      panelClass: 'bg-zinc-900', // To avoid default white background flashes if any
      backdropClass: 'bg-black/50'
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.toggleComplete.emit({ exIndex, setIndex });
      }
    });
  }

  markAsComplete(exIndex: number, setIndex: number): void {
    this.toggleComplete.emit({ exIndex, setIndex });
  }
}
