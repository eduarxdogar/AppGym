import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditarSuperSetModalComponent } from './editar-super-set-modal.component';

describe('EditarSuperSetModalComponent', () => {
  let component: EditarSuperSetModalComponent;
  let fixture: ComponentFixture<EditarSuperSetModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarSuperSetModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditarSuperSetModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
