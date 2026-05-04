import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UiStateService {
  isAiDrawerOpen = signal<boolean>(false);

  toggleAiDrawer() {
    this.isAiDrawerOpen.update(v => !v);
  }

  openAiDrawer() {
    this.isAiDrawerOpen.set(true);
  }

  closeAiDrawer() {
    this.isAiDrawerOpen.set(false);
  }
}
