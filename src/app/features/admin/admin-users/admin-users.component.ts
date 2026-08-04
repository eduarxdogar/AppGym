import {
  Component,
  inject,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminUsersStore } from './store/admin-users.store';
import { UiIconComponent } from '../../../shared/ui/ui-icon/ui-icon.component';
import { UsersTableComponent } from './ui/users-table/users-table.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, UiIconComponent, UsersTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-users.component.html',
  providers: [AdminUsersStore]
})
export class AdminUsersComponent implements OnInit {
  public readonly store = inject(AdminUsersStore);

  ngOnInit(): void {
    this.store.loadUsers();
  }
}
