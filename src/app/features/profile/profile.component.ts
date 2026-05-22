import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Auth, updateProfile } from '@angular/fire/auth';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';

import { AuthService } from '../../core/services/auth.service';
import { UserProfileStateService } from '../../core/services/user-profile-state.service';
import { UserProfileService } from '../../core/services/user-profile.service';
import { GamificationService } from '../../core/services/gamification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './profile.component.html'
})
export class ProfileComponent {
  private authService = inject(AuthService);
  private auth = inject(Auth);
  private storage = inject(Storage);
  private router = inject(Router);
  private userProfileState = inject(UserProfileStateService);
  private userProfileService = inject(UserProfileService);
  private gamificationService = inject(GamificationService);

  currentUser = this.authService.currentUser;
  userProfile = this.userProfileState.profile;
  gamificationState = this.gamificationService.gamificationState;

  availableEquipment = [
    { name: 'Polea', icon: 'cable' },
    { name: 'Máquina Smith', icon: 'view_in_ar' },
    { name: 'Máquinas', icon: 'settings' },
    { name: 'Mancuernas', icon: 'fitness_center' },
    { name: 'Barra', icon: 'horizontal_rule' },
    { name: 'Kettlebells', icon: 'sports_gymnastics' },
    { name: 'Bandas', icon: 'line_weight' },
    { name: 'Calistenia', icon: 'accessibility_new' }
  ];

  selectedEquipment = signal<string[]>([]);
  isSaving = signal<boolean>(false);
  isUploading = signal<boolean>(false);

  constructor() {
    effect(() => {
      const profile = this.userProfileState.profile();
      if (profile && profile.equipment) {
        this.selectedEquipment.set([...profile.equipment]);
      }
    }, { allowSignalWrites: true });
  }

  toggleEquipment(item: string) {
     const current = this.selectedEquipment();
     if (current.includes(item)) {
        this.selectedEquipment.set(current.filter(eq => eq !== item));
     } else {
        this.selectedEquipment.set([...current, item]);
     }
  }

  async saveEquipment() {
     this.isSaving.set(true);
     try {
        await this.userProfileService.updateEquipment(this.selectedEquipment());
        await this.userProfileState.refreshProfile();
     } catch (error) {
        console.error('Error saving equipment:', error);
     } finally {
        this.isSaving.set(false);
     }
  }

  async uploadProfilePhoto(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const user = this.auth.currentUser;
    if (!user) return;

    this.isUploading.set(true);
    try {
      const filePath = `profilePhotos/${user.uid}/${file.name}`;
      const storageRef = ref(this.storage, filePath);
      
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);
      
      await updateProfile(user, { photoURL });
      
      window.location.reload(); 
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      this.isUploading.set(false);
    }
  }

  triggerFileInput() {
    document.getElementById('photoUpload')?.click();
  }

  async logout() {
    await this.authService.logout();
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
