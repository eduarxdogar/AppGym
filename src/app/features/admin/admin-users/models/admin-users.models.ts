import { UserProfile } from '../../../account/models/user-profile.model';

export type AdminUserRow = UserProfile & { uid: string };
