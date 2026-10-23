import { appTestProviders } from '../../../testing/app-test.providers';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutDetailComponent } from './workout-detail.component';

describe('WorkoutDetailComponent', () => {
  let component: WorkoutDetailComponent;
  let fixture: ComponentFixture<WorkoutDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: appTestProviders(),
      imports: [WorkoutDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutDetailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'test-workout');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
