/** Stable equipment vocabulary for saved profiles and server-side workout constraints. */
export function profileEquipment(profile: { baseGym?: string; equipment?: string[]; availableEquipment?: string[] }): string[] {
  const gym = profile.baseGym?.trim().toLowerCase();
  if (!gym || ['home gym', 'calistenia'].includes(gym)) return ['BODYWEIGHT'];
  const selected = profile.equipment ?? [];
  if (!selected.length || selected.every(item => ['calistenia', 'bodyweight'].includes(item.trim().toLowerCase()))) {
    return ['BODYWEIGHT'];
  }
  return [...new Set(selected.map(item => item.trim()).filter(Boolean))];
}
