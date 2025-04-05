import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExerciseSelectorComponent } from './exercise-selector.component';

describe('ExerciseSelectorComponent', () => {
  let component: ExerciseSelectorComponent;
  let fixture: ComponentFixture<ExerciseSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExerciseSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
