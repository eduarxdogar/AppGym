import { profileEquipment } from './equipment';

describe('Profile equipment vocabulary', () => {
  it('uses only BODYWEIGHT for absent gym, Home Gym and Calistenia, even with stale machine selections', () => {
    for (const baseGym of [undefined, '', '   ', ' Home Gym ', 'CALISTENIA']) {
      expect(profileEquipment({ baseGym, equipment: ['Máquinas'] })).toEqual(['BODYWEIGHT']);
    }
  });
  it('normalizes commercial equipment and handles no equipment or calisthenics-only selections', () => {
    expect(profileEquipment({ baseGym: 'Smart Fit', equipment: [' Mancuernas ', 'Mancuernas', 'Barra'] }))
      .toEqual(['Mancuernas', 'Barra']);
    for (const equipment of [undefined, [], ['Calistenia'], ['BODYWEIGHT']]) {
      expect(profileEquipment({ baseGym: 'Otro', equipment })).toEqual(['BODYWEIGHT']);
    }
  });
});
