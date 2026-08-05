import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-edit-set-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="bg-zinc-900 text-white p-6 rounded-lg min-w-[320px]">
      <h2 mat-dialog-title class="text-xl font-bold mb-4 text-[#CCFF00]">¿Editar Serie?</h2>
      <mat-dialog-content class="mb-6">
        <p class="text-zinc-300">¿Seguro que quieres modificar esta serie completada? Al editar, perderá su estado de "completada".</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="gap-3">
        <button mat-button mat-dialog-close class="!text-zinc-400 !font-medium">
          Cancelar
        </button>
        <button mat-button [mat-dialog-close]="true" class="!text-zinc-900 !bg-[#CCFF00] !px-4 !py-1 !rounded-md !font-bold">
          Editar Serie
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class EditSetDialogComponent {}
