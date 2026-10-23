import { AdminUserRow } from '../models/admin-users.models';

export function uidFromProfilePath(path: string): string {
  const match = /^users\/([^/]+)\/profile\/data$/.exec(path);
  if (!match) throw new Error('Ruta de perfil inválida');
  return match[1];
}

export function profileRow(path: string, data: Record<string, unknown>): AdminUserRow {
  // Path identity always overrides any uid/profilePath stored inside the document.
  return { ...data, uid: uidFromProfilePath(path), profilePath: path } as AdminUserRow;
}
