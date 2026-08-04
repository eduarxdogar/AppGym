import { TestBed } from '@angular/core/testing';
import { AdminExercisesStore } from './admin-exercises.store';
import { AdminExercisesQueries } from '../api/admin-exercises.queries';
import { AdminExercisesCommands } from '../api/admin-exercises.commands';
import { AdminExercise } from '../models/admin-exercises.models';
import { ToastService } from '../../../../core/services/toast.service';

describe('AdminExercisesStore', () => {
  let store: AdminExercisesStore;
  let queriesSpy: jasmine.SpyObj<AdminExercisesQueries>;
  let commandsSpy: jasmine.SpyObj<AdminExercisesCommands>;

  beforeEach(() => {
    const qSpy = jasmine.createSpyObj('AdminExercisesQueries', ['getExercises']);
    const cSpy = jasmine.createSpyObj('AdminExercisesCommands', ['createExercise', 'updateExercise']);
    const toastSpy = jasmine.createSpyObj('ToastService', ['showSuccess', 'showError']);

    TestBed.configureTestingModule({
      providers: [
        AdminExercisesStore,
        { provide: AdminExercisesQueries, useValue: qSpy },
        { provide: AdminExercisesCommands, useValue: cSpy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });
    store = TestBed.inject(AdminExercisesStore);
    queriesSpy = TestBed.inject(AdminExercisesQueries) as jasmine.SpyObj<AdminExercisesQueries>;
    commandsSpy = TestBed.inject(AdminExercisesCommands) as jasmine.SpyObj<AdminExercisesCommands>;
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
    queriesSpy.getExercises.and.returnValue(Promise.resolve(mockList));

    await store.loadExercises();

    expect(queriesSpy.getExercises).toHaveBeenCalled();
    expect(store.exercisesList()).toHaveSize(1);
    expect(store.isLoading()).toBeFalse();
  });
});
