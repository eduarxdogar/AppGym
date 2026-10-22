import { Component } from '@angular/core';
import { RecoveryMonitorComponent } from '../../dashboard/components/recovery-monitor/recovery-monitor.component';
import { appTestProviders } from '../../../testing/app-test.providers';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutListComponent } from './workout-list.component';

@Component({ selector: 'app-recovery-monitor', standalone: true, template: '' })
class RecoveryMonitorStub {}

describe('WorkoutListComponent', () => {
  let component: WorkoutListComponent;
  let fixture: ComponentFixture<WorkoutListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: appTestProviders(),
      imports: [WorkoutListComponent]
    })
    .overrideComponent(WorkoutListComponent, { remove: { imports: [RecoveryMonitorComponent] }, add: { imports: [RecoveryMonitorStub] } })
    .compileComponents();

    fixture = TestBed.createComponent(WorkoutListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
