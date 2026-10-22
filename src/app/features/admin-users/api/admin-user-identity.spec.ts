import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { AdminUsersCommands } from './admin-users.commands';
import { profileRow, uidFromProfilePath } from './admin-user-identity';

describe('Admin user identity', () => {
  it('derives identity exclusively from the snapshot path even with forged data fields', () => {
    const row = profileRow('users/attacker/profile/data', {
      uid: 'victim', profilePath: 'users/victim/profile/data', displayName: 'Example',
    });
    expect(row.uid).toBe('attacker');
    expect(row.profilePath).toBe('users/attacker/profile/data');
    expect(uidFromProfilePath(row.profilePath)).toBe('attacker');
  });
  it('rejects arbitrary UIDs and invalid document paths before any Firebase write', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: Firestore, useValue: {} }] });
    const commands = TestBed.inject(AdminUsersCommands);
    for (const path of ['victim', 'users/victim/profile/other', 'users/victim/profile/data/nested/doc']) {
      await expectAsync(commands.hardDeleteAccount(path)).toBeRejectedWithError('Ruta de perfil inválida');
    }
  });
});
