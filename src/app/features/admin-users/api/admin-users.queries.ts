import { Injectable, inject } from '@angular/core';
import { Firestore, collectionGroup, getDocs, query } from '@angular/fire/firestore';
import { AdminUserRow } from '../models/admin-users.models';
import { profileRow } from './admin-user-identity';

@Injectable({ providedIn: 'root' })
export class AdminUsersQueries {
  private readonly firestore = inject(Firestore);

  async getAllProfiles(): Promise<AdminUserRow[]> {
    const profilesQuery = query(collectionGroup(this.firestore, 'profile'));
    const querySnapshot = await getDocs(profilesQuery);

    return querySnapshot.docs
      .map(snap => {
        if (!/^users\/[^/]+\/profile\/data$/.test(snap.ref.path)) return null;
        return profileRow(snap.ref.path, snap.data());
      })
      .filter((p): p is AdminUserRow => p !== null);
  }
}
