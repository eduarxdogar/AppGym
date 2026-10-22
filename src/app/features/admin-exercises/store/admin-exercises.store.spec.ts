import { TestBed } from '@angular/core/testing';
import { AdminExercisesStore } from './admin-exercises.store';
import { AdminExercisesQueries } from '../api/admin-exercises.queries';
import { AdminExercisesCommands } from '../api/admin-exercises.commands';
import { AdminExercise } from '../models/admin-exercises.models';
import { ToastService } from '../../../core/services/toast.service';

describe('AdminExercisesStore', () => {
  let store: AdminExercisesStore;
  let apiSpy: jasmine.SpyObj<AdminExercisesQueries>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AdminExercisesQueries', ['getExercises']);
    const toastSpy = jasmine.createSpyObj('ToastService', ['showSuccess', 'showError']);

    TestBed.configureTestingModule({
      providers: [
        AdminExercisesStore,
        { provide: AdminExercisesQueries, useValue: spy },
        { provide: AdminExercisesCommands, useValue: jasmine.createSpyObj('commands', ['createExercise', 'updateExercise']) },
        { provide: ToastService, useValue: toastSpy }
      ]
    });
    store = TestBed.inject(AdminExercisesStore);
    apiSpy = TestBed.inject(AdminExercisesQueries) as jasmine.SpyObj<AdminExercisesQueries>;
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
