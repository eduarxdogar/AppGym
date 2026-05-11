import { Component, inject, signal, computed, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { UiStateService } from '../../../core/services/ui-state.service';
import { FormsModule } from '@angular/forms';
import { ChatAiService } from '../../../core/services/ai/chat-ai.service';

@Component({
  selector: 'app-ai-coach-drawer',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './ai-coach-drawer.component.html',
})
export class AiCoachDrawerComponent {
  uiState = inject(UiStateService);
  private readonly aiCoachService = inject(ChatAiService);

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  userMessage = '';
  isLoading = false;

  // Bind directly to the service's messages signal for persistence
  messages = computed(() => {
    const msgs = this.aiCoachService.messages();
    if (msgs.length === 0) {
      return [{ role: 'coach', text: '¡Hola! Soy tu AI Coach. Estoy conectado y monitoreando tu progreso. ¿Qué quieres mutar hoy?' } as any];
    }
    return msgs;
  });

  constructor() {
    // Auto-scroll when messages change or loading state changes
    effect(() => {
      // Accessing these values to trigger effect on changes
      if (this.messages().length || this.isLoading) {
        this.scrollToBottom();
      }
    });
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.scrollContainer) {
        const el = this.scrollContainer.nativeElement;
        el.scrollTo({
          top: el.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  }

  selectedImage = signal<string | null>(null);
  selectedImageMimeType = '';

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
        const dataUrl = e.target.result;
        // Extract actual mime type from dataURL
        const mimeMatch = dataUrl.match(/data:([^;]+);base64/);
        if (mimeMatch) {
            this.selectedImageMimeType = mimeMatch[1];
            this.selectedImage.set(dataUrl);
        }
    };
    reader.readAsDataURL(file);
    // Reset input value to allow selecting same file again
    event.target.value = '';
  }

  removeImage() {
    this.selectedImage.set(null);
    this.selectedImageMimeType = '';
  }

  async sendMessage(event?: Event) {
    if (event) {
      event.preventDefault(); // Prevent new line on enter
    }

    const txt = this.userMessage.trim();
    const hasImage = !!this.selectedImage();
    
    if ((!txt && !hasImage) || this.isLoading) return;

    // Capture state before clearing
    const imageBase64Full = this.selectedImage();
    const mimeType = this.selectedImageMimeType;
    let cleanBase64 = undefined;
    if (imageBase64Full) {
        cleanBase64 = imageBase64Full.split(',')[1];
    }

    // UI Feedback
    this.userMessage = '';
    this.removeImage();
    this.isLoading = true;

    try {
      await this.aiCoachService.chatWithCoach(txt, cleanBase64, mimeType);
      // The service already pushes to the signal array, so we don't need to manually push here!
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoading = false;
    }
  }
}
