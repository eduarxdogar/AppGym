import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminExercisesComponent } from './admin-exercises.component';
import { AdminExercisesStore } from './store/admin-exercises.store';
import { ReactiveFormsModule } from '@angular/forms';
import { signal } from '@angular/core';
import { Router } from '@angular/router';

describe('AdminExercisesComponent', () => {
  let component: AdminExercisesComponent;
  let fixture: ComponentFixture<AdminExercisesComponent>;

  beforeEach(async () => {
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    
    // Mock the Store
    const mockStore = {
      isLoading: signal(false),
      isSaving: signal(false),
      isSideSheetOpen: signal(false),
      editingExerciseId: signal(null),
      exercisesList: signal([]),
      searchQuery: signal(''),
      filterMuscle: signal(''),
      filterDiscipline: signal(''),
      filteredExercises: signal([]),
      loadExercises: jasmine.createSpy('loadExercises'),
      saveExercise: jasmine.createSpy('saveExercise'),
      openSideSheet: jasmine.createSpy('openSideSheet'),
      closeSideSheet: jasmine.createSpy('closeSideSheet')
    };

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, AdminExercisesComponent],
      providers: [
        { provide: Router, useValue: routerSpy }
      ]
    })
    .overrideComponent(AdminExercisesComponent, {
      set: {
        providers: [
          { provide: AdminExercisesStore, useValue: mockStore }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminExercisesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and call loadExercises on init', () => {
    expect(component).toBeTruthy();
    expect(component.store.loadExercises).toHaveBeenCalled();
  });
});
