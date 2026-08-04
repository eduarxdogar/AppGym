import { Component, input, output, TemplateRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiTableComponent } from '../../../../shared/ui/ui-table/ui-table.component';
import { UiIconComponent } from '../../../../shared/ui/ui-icon/ui-icon.component';
import { AdminExercise } from '../../models/admin-exercises.models';
import { createColumnHelper, ColumnDef } from '@tanstack/angular-table';

@Component({
  selector: 'app-exercise-table',
  standalone: true,
  imports: [CommonModule, UiTableComponent, UiIconComponent],
  template: `
    <div class="mt-4">
      <app-ui-table [data]="data()" [columns]="columns"></app-ui-table>
    </div>

    <ng-template #nameCell let-info>
      <div class="flex items-center gap-4 py-1">
        <div class="h-10 w-10 rounded-xl bg-zinc-800 overflow-hidden relative border border-zinc-700 flex-shrink-0 shadow-inner">
          <img [src]="info.row.original.imageUrl || 'assets/default-exercise.png'" alt="Exercise" class="h-full w-full object-cover transition-opacity"
            (error)="$any($event.target).src='assets/default-exercise.png'">
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-text-main font-bold text-sm leading-tight truncate" [title]="info.row.original.name">{{ info.row.original.name }}</h4>
        </div>
      </div>
    </ng-template>

    <ng-template #tagsCell let-info>
      <div class="flex gap-1.5 flex-wrap">
        <span class="px-2 py-0.5 bg-zinc-800/80 border border-zinc-700 rounded text-[9px] uppercase tracking-widest text-text-muted">
          {{ info.row.original.type }}
        </span>
        @if (info.row.original.videoUrl) {
          <span class="px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-[9px] uppercase tracking-widest text-red-500 font-bold" title="Tiene Video de YouTube">
            Video
          </span>
        }
      </div>
    </ng-template>

    <ng-template #actionCell let-info>
      <div class="flex justify-end">
        <button (click)="edit.emit(info.row.original)" class="text-text-muted hover:text-primary bg-zinc-900/50 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-transparent hover:border-zinc-700 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2">
          Editar <app-ui-icon name="pencil" [size]="12"></app-ui-icon>
        </button>
      </div>
    </ng-template>
  `
})
export class ExerciseTableComponent implements OnInit {
  data = input.required<AdminExercise[]>();
  edit = output<AdminExercise>();

  @ViewChild('nameCell', { static: true }) nameCell!: TemplateRef<any>;
  @ViewChild('tagsCell', { static: true }) tagsCell!: TemplateRef<any>;
  @ViewChild('actionCell', { static: true }) actionCell!: TemplateRef<any>;

  columns: ColumnDef<AdminExercise, any>[] = [];

  ngOnInit(): void {
    const helper = createColumnHelper<AdminExercise>();
    this.columns = [
      helper.accessor('name', {
        header: 'Ejercicio',
        cell: this.nameCell as any,
      }),
      helper.accessor('muscleGroup', {
        header: 'Músculo',
      }),
      helper.accessor('discipline', {
        header: 'Disciplina',
      }),
      helper.accessor('type', {
        header: 'Detalles',
        cell: this.tagsCell as any,
      }),
      helper.display({
        id: 'actions',
        header: 'Acción',
        cell: this.actionCell as any,
      })
    ];
  }
}
