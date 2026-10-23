import { UserProfile } from '../../../core/models/user-profile.model';

export type AdminUserRow = UserProfile & { readonly uid: string; readonly profilePath: string };
