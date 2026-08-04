import { Component, input, output, TemplateRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiTableComponent } from '../../../../shared/ui/ui-table/ui-table.component';
import { UiIconComponent } from '../../../../shared/ui/ui-icon/ui-icon.component';
import { AdminUserRow } from '../../models/admin-users.models';
import { SUBSCRIPTION_LABELS } from '../../constants/admin-users.constants';
import { createColumnHelper, ColumnDef } from '@tanstack/angular-table';

@Component({
  selector: 'app-users-table',
  standalone: true,
  imports: [CommonModule, UiTableComponent, UiIconComponent],
  template: `
    <div class="mt-4">
      <app-ui-table [data]="data()" [columns]="columns"></app-ui-table>
    </div>

    <ng-template #nameCell let-info>
      <div class="flex items-center gap-3 min-w-0">
        <div class="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold uppercase"
             [ngClass]="info.row.original.isDeleted
               ? 'bg-zinc-700 text-zinc-400'
               : 'bg-lime-400/10 text-lime-400'">
          {{ (info.row.original.displayName || 'U').charAt(0) }}
        </div>
        <span class="truncate text-sm font-medium" [ngClass]="info.row.original.isDeleted ? 'text-zinc-500' : 'text-white'">
          {{ info.row.original.displayName || '—' }}
        </span>
      </div>
    </ng-template>

    <ng-template #emailCell let-info>
      <div class="min-w-0" [class.opacity-50]="info.row.original.isDeleted">
        <p class="truncate text-sm text-zinc-300">{{ info.row.original.email || '—' }}</p>
        <p class="truncate text-[10px] text-zinc-600 font-mono mt-0.5">{{ info.row.original.uid }}</p>
      </div>
    </ng-template>

    <ng-template #subCell let-info>
      <div [class.opacity-50]="info.row.original.isDeleted">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
              [ngClass]="{
                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': info.row.original.subscriptionStatus === 'active',
                'bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20': info.row.original.subscriptionStatus === 'trialing',
                'bg-zinc-700/40 text-zinc-500 border border-zinc-700': !info.row.original.subscriptionStatus || info.row.original.subscriptionStatus === 'canceled',
                'bg-red-500/10 text-red-400 border border-red-500/20': info.row.original.subscriptionStatus === 'past_due'
              }">
          {{ subscriptionLabel(info.row.original.subscriptionStatus) }}
        </span>
      </div>
    </ng-template>

    <ng-template #statusCell let-info>
      <div [class.opacity-50]="info.row.original.isDeleted">
        @if (!info.row.original.isDeleted) {
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block"></span>
            Activo
          </span>
        }
        @if (info.row.original.isDeleted) {
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20"
            [title]="'Eliminado: ' + formatDeletedAt(info.row.original.deletedAt)">
            <span class="h-1.5 w-1.5 rounded-full bg-red-400 inline-block"></span>
            Eliminado
          </span>
        }
      </div>
    </ng-template>

    <ng-template #actionCell let-info>
      <div class="flex justify-end gap-2">
        <button
          [id]="'btn-seed-' + info.row.original.uid"
          (click)="seed.emit(info.row.original)"
          [disabled]="seedingUid() === info.row.original.uid || deletingUid() === info.row.original.uid"
          class="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider hover:bg-purple-500 hover:text-white hover:border-purple-500 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed">
          @if (seedingUid() !== info.row.original.uid) {
            <app-ui-icon name="flask-conical" [size]="16"></app-ui-icon>
          }
          @if (seedingUid() === info.row.original.uid) {
            <div class="h-3.5 w-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          }
          {{ seedingUid() === info.row.original.uid ? 'Inyectando...' : 'Inyectar' }}
        </button>
        <button
          [id]="'btn-hard-delete-' + info.row.original.uid"
          (click)="hardDelete.emit(info.row.original)"
          [disabled]="deletingUid() === info.row.original.uid"
          class="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(239,68,68,0.1)] hover:shadow-[0_0_16px_rgba(239,68,68,0.3)]">
          @if (deletingUid() !== info.row.original.uid) {
            <app-ui-icon name="trash-2" [size]="16"></app-ui-icon>
          }
          @if (deletingUid() === info.row.original.uid) {
            <div class="h-3.5 w-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
          }
          {{ deletingUid() === info.row.original.uid ? 'Eliminando...' : 'Eliminar' }}
        </button>
      </div>
    </ng-template>
  `
})
export class UsersTableComponent implements OnInit {
  data = input.required<AdminUserRow[]>();
  seedingUid = input.required<string | null>();
  deletingUid = input.required<string | null>();
  
  seed = output<AdminUserRow>();
  hardDelete = output<AdminUserRow>();

  @ViewChild('nameCell', { static: true }) nameCell!: TemplateRef<any>;
  @ViewChild('emailCell', { static: true }) emailCell!: TemplateRef<any>;
  @ViewChild('subCell', { static: true }) subCell!: TemplateRef<any>;
  @ViewChild('statusCell', { static: true }) statusCell!: TemplateRef<any>;
  @ViewChild('actionCell', { static: true }) actionCell!: TemplateRef<any>;

  columns: ColumnDef<AdminUserRow, any>[] = [];

  ngOnInit(): void {
    const helper = createColumnHelper<AdminUserRow>();
    this.columns = [
      helper.accessor('displayName', {
        header: 'Nombre',
        cell: this.nameCell as any,
      }),
      helper.accessor('email', {
        header: 'Email / UID',
        cell: this.emailCell as any,
      }),
      helper.accessor('subscriptionStatus', {
        header: 'Suscripción',
        cell: this.subCell as any,
      }),
      helper.display({
        id: 'status',
        header: 'Estado',
        cell: this.statusCell as any,
      }),
      helper.display({
        id: 'action',
        header: 'Acción',
        cell: this.actionCell as any,
      }),
    ];
  }

  subscriptionLabel(status?: string): string {
    return SUBSCRIPTION_LABELS[status ?? ''] ?? 'Sin Plan';
  }

  formatDeletedAt(ts?: number): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
}
