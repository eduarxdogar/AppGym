import { TestBed } from '@angular/core/testing';
import { AdminExercisesStore } from './admin-exercises.store';
import { AdminExercisesApi, AdminExercise } from '../services/admin-exercises.api';
import { ToastService } from '../../../core/services/toast.service';

describe('AdminExercisesStore', () => {
  let store: AdminExercisesStore;
  let apiSpy: jasmine.SpyObj<AdminExercisesApi>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AdminExercisesApi', ['getExercises', 'createExercise', 'updateExercise']);
    const toastSpy = jasmine.createSpyObj('ToastService', ['showSuccess', 'showError']);

    TestBed.configureTestingModule({
      providers: [
        AdminExercisesStore,
        { provide: AdminExercisesApi, useValue: spy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });
    store = TestBed.inject(AdminExercisesStore);
    apiSpy = TestBed.inject(AdminExercisesApi) as jasmine.SpyObj<AdminExercisesApi>;
  });

  it('should be created with isLoading false', () => {
    expect(store).toBeTruthy();
    expect(store.isLoading()).toBeFalse();
  });

  it('should load exercises correctly', async () => {
    const mockList: AdminExercise[] = [{
      id: '1',
      name: 'Test',
      discipline: 'gym',
      muscleGroup: 'pecho',
      type: 'compound',
      difficulty: 'beginner',
      instructions: [],
      equipmentRequired: [],
      imageUrl: ''
    }];
    apiSpy.getExercises.and.returnValue(Promise.resolve(mockList));

    await store.loadExercises();

    expect(apiSpy.getExercises).toHaveBeenCalled();
    expect(store.exercisesList()).toHaveSize(1);
    expect(store.isLoading()).toBeFalse();
  });
});
