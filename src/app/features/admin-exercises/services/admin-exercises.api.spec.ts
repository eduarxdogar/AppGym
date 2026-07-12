import { TestBed } from '@angular/core/testing';
import { AdminExercisesApi } from './admin-exercises.api';
import { Firestore } from '@angular/fire/firestore';

describe('AdminExercisesApi', () => {
  let service: AdminExercisesApi;

  beforeEach(() => {
    const firestoreMock = {};

    TestBed.configureTestingModule({
      providers: [
        AdminExercisesApi,
        { provide: Firestore, useValue: firestoreMock }
      ]
    });
    service = TestBed.inject(AdminExercisesApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
