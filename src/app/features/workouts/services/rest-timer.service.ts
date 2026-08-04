import { Injectable, signal, computed, OnDestroy } from '@angular/core';

/** Durations available for rest timer, in seconds */
export const REST_PRESETS_SECONDS = [60, 90, 120, 180] as const;
export type RestPreset = (typeof REST_PRESETS_SECONDS)[number];

@Injectable({
  providedIn: 'root'
})
export class RestTimerService implements OnDestroy {
  // Total duration chosen by the user
  readonly durationSeconds = signal<number>(90);

  // Seconds remaining (counts down)
  readonly remaining = signal<number>(90);

  // Whether the timer is actively running
  readonly isRunning = signal<boolean>(false);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private targetTime: number | null = null;

  // Formatted MM:SS string
  readonly formatted = computed<string>(() => {
    const t = this.remaining();
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  });

  readonly progress = computed<number>(() => {
    const dur = this.durationSeconds();
    if (dur === 0) return 0;
    return Math.max(0, Math.min(1, this.remaining() / dur));
  });

  /** Start or resume the timer */
  start(durationSeconds?: number) {
    if (durationSeconds !== undefined) {
      this.durationSeconds.set(durationSeconds);
      this.remaining.set(durationSeconds);
    }
    
    // Set target time based on remaining seconds
    this.targetTime = Date.now() + (this.remaining() * 1000);

    if (this.isRunning()) return; // already running
    this.isRunning.set(true);

    this.intervalId = setInterval(() => {
      if (!this.targetTime) return;
      
      const now = Date.now();
      const left = Math.ceil((this.targetTime - now) / 1000);
      
      if (left <= 0) {
        this.remaining.set(0);
        this.stop();
      } else {
        this.remaining.set(left);
      }
    }, 500); // Check every 500ms for better responsiveness
  }

  /** Pause without resetting */
  pause() {
    this.isRunning.set(false);
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.targetTime = null;
  }

  /** Stop and reset to full duration */
  stop() {
    this.pause();
    this.remaining.set(this.durationSeconds());
  }

  /** Quick-start with a preset duration */
  quickStart(seconds: number) {
    this.stop();
    this.start(seconds);
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
