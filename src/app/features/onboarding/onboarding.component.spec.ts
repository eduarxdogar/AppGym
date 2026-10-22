import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';
import { UserProfileService } from '../../core/services/user-profile.service';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { InbodyAiService } from '../../core/services/ai/inbody-ai.service';
import { ToastService } from '../../core/services/toast.service';
import { InbodyScanSchema, InbodyValidationError } from '../../core/models/inbody-scan.schema';

describe('OnboardingComponent', () => {
  let fixture: ComponentFixture<OnboardingComponent>;
  let component: OnboardingComponent;
  let save: jasmine.Spy;
  let scan: jasmine.Spy;
  let refresh: jasmine.Spy;
  let toast: jasmine.Spy;
  let navigate: jasmine.Spy;
  function upload(file = new File(['report'], 'inbody.png', { type: 'image/png' })): Event {
    return { target: { files: [file], value: 'inbody.png' } } as unknown as Event;
  }
  beforeEach(async () => {
    spyOn(console, 'error'); // Validation and offline failures below are intentional.
    save = jasmine.createSpy('saveProfile').and.resolveTo();
    scan = jasmine.createSpy('scanInBodyReport').and.resolveTo(InbodyScanSchema.parse({ muscleKg: 35 }));
    refresh = jasmine.createSpy('refreshProfile'); toast = jasmine.createSpy('showError');
    await TestBed.configureTestingModule({ imports: [OnboardingComponent], providers: [provideRouter([]),
      { provide: UserProfileService, useValue: { saveProfile: save } },
      { provide: UserProfileStateService, useValue: { refreshProfile: refresh } },
      { provide: InbodyAiService, useValue: { scanInBodyReport: scan } },
      { provide: ToastService, useValue: { showError: toast } },
    ] }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('requires valid biometrics, experience level and availability before advancing', () => {
    component.profile.weight = -1; component.nextStep(); expect(component.step()).toBe(0);
    component.profile.weight = NaN; expect(component.canProceed()).toBeFalse();
    component.profile.weight = 75; component.profile.height = 0; expect(component.canProceed()).toBeFalse();
    component.profile.height = 175; component.nextStep(); expect(component.step()).toBe(1);
    component.profile.availableDays = []; component.nextStep(); expect(component.step()).toBe(1);
    component.profile.availableDays = ['Lunes']; component.profile.fitnessLevel = undefined;
    expect(component.canProceed()).toBeFalse();
  });
  it('does not replace missing mandatory values with defaults at submission', async () => {
    component.step.set(2); component.profile.goal = undefined;
    await component.saveProfile();
    expect(save).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    expect(component.error()).toContain('Datos de perfil inválidos');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Datos de perfil inválidos');
    expect(component.isSaving()).toBeFalse();
  });
  it('saves explicit completion and navigates only after persistence succeeds', async () => {
    let finish!: () => void;
    save.and.returnValue(new Promise<void>(resolve => { finish = resolve; }));
    const saving = component.saveProfile();
    await component.saveProfile();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.calls.mostRecent().args[0].onboardingCompleted).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
    finish(); await saving;
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/weekly-plan'], { queryParams: { autoGenerate: 'true' } });
    expect(component.isSaving()).toBeFalse();
  });
  for (const baseGym of ['', 'Home Gym', 'Calistenia']) {
    it(`persists BODYWEIGHT with no external equipment for gym '${baseGym}'`, async () => {
      component.profile.baseGym = baseGym;
      component.profile.equipment = ['Máquinas', 'Mancuernas'];
      await component.saveProfile();
      expect(save.calls.mostRecent().args[0].availableEquipment).toEqual(['BODYWEIGHT']);
      expect(save.calls.mostRecent().args[0].equipment).toEqual(['Calistenia']);
      expect(navigate).toHaveBeenCalled();
    });
  }
  it('preserves selected commercial gym equipment and normalizes calisthenics-only selection', async () => {
    component.profile.baseGym = 'Smart Fit';
    component.profile.equipment = ['Máquinas', 'Mancuernas'];
    await component.saveProfile();
    expect(save.calls.mostRecent().args[0].availableEquipment).toEqual(['Máquinas', 'Mancuernas']);
    component.profile.equipment = ['Calistenia'];
    await component.saveProfile();
    expect(save.calls.mostRecent().args[0].availableEquipment).toEqual(['BODYWEIGHT']);
  });
  it('shows a save error without advancing or marking the local draft complete', async () => {
    save.and.rejectWith(new Error('offline'));
    await component.saveProfile();
    expect(component.error()).toContain('Error al guardar');
    expect(component.profile.onboardingCompleted).not.toBeTrue();
    expect(refresh).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    expect(component.isSaving()).toBeFalse();
  });
  it('persists a partial InBody response with null segmental defaults and no undefined fields', async () => {
    await component.onInBodySelected(upload());
    expect(component.profile.inbodyData?.segmentalMuscle?.rightArm).toBeNull();
    await component.saveProfile();
    const data = save.calls.mostRecent().args[0];
    const assertDefined = (value: unknown): void => {
      expect(value).not.toBeUndefined();
      if (value && typeof value === 'object') Object.values(value).forEach(assertDefined);
    };
    assertDefined(data);
    expect(component.scanningInBody()).toBeFalse();
  });
  it('prevents submission during scanning and keeps an earlier valid report on scan failure', async () => {
    const previous = InbodyScanSchema.parse({ muscleKg: 35 });
    component.profile.inbodyData = previous;
    scan.and.rejectWith(new InbodyValidationError());
    const scanning = component.onInBodySelected(upload());
    await component.saveProfile(); expect(save).not.toHaveBeenCalled();
    await scanning;
    expect(component.profile.inbodyData).toBe(previous);
    expect(toast).toHaveBeenCalledWith(jasmine.stringMatching('valores válidos'));
    expect(component.scanningInBody()).toBeFalse();
  });
  it('explains expired access and rejects unsupported or unreadable files without crashing', async () => {
    scan.and.rejectWith({ code: 'functions/permission-denied' });
    await component.onInBodySelected(upload());
    expect(toast).toHaveBeenCalledWith(jasmine.stringMatching('suscripción'));
    scan.calls.reset();
    await component.onInBodySelected(upload(new File(['x'], 'bad.txt', { type: 'text/plain' })));
    expect(scan).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(jasmine.stringMatching('PDF'));
    spyOn(window, 'FileReader').and.returnValue({
      readAsDataURL(this: { onerror: () => void }) { this.onerror(); },
    } as unknown as FileReader);
    await component.onInBodySelected(upload());
    expect(toast).toHaveBeenCalledWith(jasmine.stringMatching('leer el archivo'));
    expect(component.scanningInBody()).toBeFalse();
  });
});
