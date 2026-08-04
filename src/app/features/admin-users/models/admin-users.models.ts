import { UserProfile } from '../../../core/models/user-profile.model';

export type AdminUserRow = UserProfile & { uid: string };
