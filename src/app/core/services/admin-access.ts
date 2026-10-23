interface AdminIdentity {
  email: string | null;
  emailVerified: boolean;
  getIdTokenResult(): Promise<{ claims: Record<string, unknown> }>;
}

/** Permissions come from Firebase's signed token, never editable profile fields. */
export async function adminAccessForUser(user: AdminIdentity | null, legacyAdminEmail: string): Promise<boolean> {
  if (!user) return false;
  try {
    const { claims } = await user.getIdTokenResult();
    return claims['admin'] === true || (user.emailVerified
      && user.email?.toLowerCase() === legacyAdminEmail.toLowerCase());
  } catch {
    return false;
  }
}
