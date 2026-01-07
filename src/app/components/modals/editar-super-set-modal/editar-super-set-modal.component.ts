import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Ejercicio } from '../../../models/ejercicio.model'; 
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/input/input.component';

@Component({
  selector: 'app-editar-super-set-modal',
  standalone: true,
  imports: [  CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,MatDialogModule,FormsModule, ButtonComponent, InputComponent
  ], 
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
