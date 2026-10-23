import { Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, timer } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TrainingClockService {
  readonly now = toSignal(timer(60_000, 60_000).pipe(map(() => Date.now())), { initialValue: Date.now() });
}
