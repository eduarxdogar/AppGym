import { Injectable, inject } from '@angular/core';
import { Firestore, collectionGroup, getDocs, query } from '@angular/fire/firestore';
import { AdminUserRow } from '../models/admin-users.models';

@Injectable({ providedIn: 'root' })
export class AdminUsersQueries {
  private readonly firestore = inject(Firestore);

  async getAllProfiles(): Promise<AdminUserRow[]> {
    const profilesQuery = query(collectionGroup(this.firestore, 'profile'));
    const querySnapshot = await getDocs(profilesQuery);

    return querySnapshot.docs
      .map(snap => {
        const uid = snap.ref.parent.parent?.id;
        if (!uid) return null;
        return { uid, ...snap.data() as any };
      })
      .filter((p): p is AdminUserRow => p !== null);
  }
}
