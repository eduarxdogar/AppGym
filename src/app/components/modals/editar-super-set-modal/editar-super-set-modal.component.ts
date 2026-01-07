import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Ejercicio } from '../../../models/ejercicio.model'; 
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatOptionModule } from '@angular/material/core';
import { UiButtonComponent } from '../../../shared/ui/ui-button/ui-button.component';
import { UiInputComponent } from '../../../shared/ui/ui-input/ui-input.component';

@Component({
  selector: 'app-editar-super-set-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatOptionModule, UiButtonComponent, UiInputComponent],
  templateUrl: './editar-super-set-modal.component.html',
})
export class EditarSuperSetModalComponent {
  ejercicio: Ejercicio;

  constructor(
    public dialogRef: MatDialogRef<EditarSuperSetModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Ejercicio
  ) {
    this.ejercicio = { ...data }; // Creamos copia para no modificar directamente
  }

  guardar(): void {
    this.dialogRef.close(this.ejercicio);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
