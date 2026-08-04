import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  createAngularTable,
  FlexRenderDirective
} from '@tanstack/angular-table';

@Component({
  selector: 'app-ui-table',
  standalone: true,
  imports: [CommonModule, FlexRenderDirective],
  template: `
    <div class="w-full overflow-x-auto bg-[#151921] border border-zinc-800 rounded-2xl shadow-2xl">
      <table class="w-full text-left text-sm text-zinc-300">
        <thead class="bg-[#0f1219] border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          @for (headerGroup of table.getHeaderGroups(); track headerGroup.id) {
            <tr>
              @for (header of headerGroup.headers; track header.id) {
                <th 
                  class="px-5 py-3 cursor-pointer select-none"
                  [attr.colspan]="header.colSpan"
                  (click)="header.column.getToggleSortingHandler()?.($event)">
                  <ng-container *ngIf="!header.isPlaceholder">
                    <div class="flex items-center gap-2">
                      <ng-container *flexRender="header.column.columnDef.header; props: header.getContext()"></ng-container>
                      <span *ngIf="header.column.getIsSorted() as sort">
                        {{ sort === 'asc' ? '▲' : '▼' }}
                      </span>
                    </div>
                  </ng-container>
                </th>
              }
            </tr>
          }
        </thead>
        <tbody>
          @for (row of table.getRowModel().rows; track row.id) {
            <tr class="border-b border-zinc-800 hover:bg-white/[0.02] transition-colors">
              @for (cell of row.getVisibleCells(); track cell.id) {
                <td class="px-5 py-4">
                  <ng-container *flexRender="cell.column.columnDef.cell; props: cell.getContext()"></ng-container>
                </td>
              }
            </tr>
          }
          @if (table.getRowModel().rows.length === 0) {
            <tr>
              <td [attr.colspan]="columns().length" class="px-5 py-10 text-center text-zinc-500">
                No hay datos disponibles.
              </td>
            </tr>
          }
        </tbody>
      </table>
      
      <div class="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-[#0f1219]">
        <div class="text-xs text-zinc-500">
          Página {{ table.getState().pagination.pageIndex + 1 }} de {{ table.getPageCount() }}
        </div>
        <div class="flex gap-2">
          <button 
            (click)="table.previousPage()" 
            [disabled]="!table.getCanPreviousPage()"
            class="px-3 py-1 text-xs rounded border border-zinc-700 disabled:opacity-50 hover:bg-zinc-800 transition">
            Anterior
          </button>
          <button 
            (click)="table.nextPage()" 
            [disabled]="!table.getCanNextPage()"
            class="px-3 py-1 text-xs rounded border border-zinc-700 disabled:opacity-50 hover:bg-zinc-800 transition">
            Siguiente
          </button>
        </div>
      </div>
    </div>
  `
})
export class UiTableComponent<T> {
  data = input.required<T[]>();
  columns = input.required<ColumnDef<T, any>[]>();

  sorting = signal<SortingState>([]);

  table = createAngularTable(() => ({
    data: this.data(),
    columns: this.columns(),
    state: {
      sorting: this.sorting(),
    },
    onSortingChange: (updaterOrValue) => {
      if (typeof updaterOrValue === 'function') {
        this.sorting.update(updaterOrValue);
      } else {
        this.sorting.set(updaterOrValue);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  }));
}
