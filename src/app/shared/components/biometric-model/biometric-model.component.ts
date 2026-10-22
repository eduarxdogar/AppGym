import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  effect,
  signal,
  Output,
  EventEmitter
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { extend, injectBeforeRender, NgtRenderState, NgtThreeEvent, NgtArgs, injectStore, injectLoader } from 'angular-three';
import { MatIconModule } from '@angular/material/icon';
import { musclesForMesh, statusForMesh } from '../../../core/models/muscle-taxonomy';
import { MuscleStatus } from '../../../core/models/workout-history.model';
import { RecoveryService } from '../../../core/services/recovery.service';
import { UserProfileStateService } from '../../../core/services/user-profile-state.service';

extend(THREE);

@Component({
  selector: 'app-biometric-model',
  standalone: true,
  imports: [NgtArgs, MatIconModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!-- Cinematic lighting rig to enhance natural textures -->
    <ngt-ambient-light [intensity]="0.8"></ngt-ambient-light>
    <ngt-directional-light [position]="[0, 10, 10]" [intensity]="1.5"></ngt-directional-light>
    <ngt-directional-light [position]="[0, 10, -10]" [intensity]="1.0"></ngt-directional-light>
    <ngt-point-light [position]="[5, 5, 5]" [intensity]="2" [distance]="50"></ngt-point-light>
    <ngt-point-light [position]="[-5, 5, 5]" [intensity]="2" [distance]="50"></ngt-point-light>

    <!-- GLTF model primitive -->
    @if (gltfReady() && modelScene()) {
      <ngt-group
        (click)="onMeshClick($event)"
        (pointerover)="onPointerOver($event)"
        (pointerout)="onPointerOut($event)">
        <ngt-primitive *args="[modelScene()]" [dispose]="null" />
      </ngt-group>
    }
  `,
})
export class BiometricModelComponent {
  private readonly recoveryService = inject(RecoveryService);
  private readonly profileState = inject(UserProfileStateService);
  private readonly store = injectStore();

  profile = this.profileState.profile;

  @Output() tooltipData = new EventEmitter<{muscle: string, x: number, y: number} | null>();
  hoveredMesh = signal<string | null>(null);

  private readonly gltf = injectLoader(() => GLTFLoader, () => 'assets/models/human-anatomy.glb');

  gltfReady = signal(false);
  loadError = signal(false);
  modelScene = signal<THREE.Group | null>(null);

  private elapsed = 0;
  private readonly meshMuscleMap = new Map<string, string>();

  constructor() {
    effect(() => {
      try {
        const result = this.gltf() as any;
        const scene = result?.scene as THREE.Group;
        if (!scene) return;

        // Calcular Bounding Box y centrar el modelo
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Centra el modelo en (0,0,0) basado en su propio centro geométrico
        scene.position.sub(center);

        // Escalar opcionalmente a 1 por si traía una escala heredada extraña
        scene.scale.set(1, 1, 1);

        // Configurar la cámara dinámicamente según el tamaño del modelo
        const maxDim = Math.max(size.x, size.y, size.z);
        const state = this.store.snapshot;
        const camera = state.camera;
        if (camera) {
           // Posiciona en Z proporcional al tamaño, y sube Y ligeramente para que encuadre bien la cabeza
           camera.position.set(0, size.y * 0.1, maxDim * 1.5);
           camera.lookAt(0, 0, 0);
           camera.updateProjectionMatrix();
        }

        // Si existen controles activos (ej. OrbitControls), forzamos su objetivo
        const controls = state.controls as any;
        if (controls) {
           controls.target.set(0, 0, 0);
           controls.update();
        }

        this.applyHeatmapMaterials(scene);
        this.modelScene.set(scene);
        this.gltfReady.set(true);
      } catch (err) {
        console.error('[BiometricModel] error:', err);
        this.loadError.set(true);
      }
    });

    injectBeforeRender(({ delta }: NgtRenderState) => {
      this.elapsed += delta;
      const scene = this.modelScene();
      if (scene) scene.rotation.y += delta * 0.4;
      this.updateEmissiveMaterials();
    });
  }

  private applyHeatmapMaterials(scene: THREE.Group): void {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      
      const meshName = child.name;
      if (musclesForMesh(meshName).length) this.meshMuscleMap.set(child.uuid, meshName);

      // Clonar el material original para evitar referencias globales
      if (Array.isArray(child.material)) {
        child.material = child.material.map(m => {
          const clone = m.clone();
          if ((clone as any).isMeshStandardMaterial) {
             const std = clone as THREE.MeshStandardMaterial;
             std.userData = { 
                originalEmissive: std.emissive.getHex(), 
                originalIntensity: std.emissiveIntensity 
             };
          }
          return clone;
        });
      } else if (child.material) {
        child.material = child.material.clone();
        if ((child.material as any).isMeshStandardMaterial) {
           const std = child.material as THREE.MeshStandardMaterial;
           std.userData = { 
              originalEmissive: std.emissive.getHex(), 
              originalIntensity: std.emissiveIntensity 
           };
        }
      }
    });
  }

  private computeMuscleEmissive(muscle: string | undefined, statusMap: Map<string, MuscleStatus>) {
    if (!muscle) return { isFatigued: false, targetColor: 0, intensityMult: 1 };
    const recoveryInfo = statusForMesh(muscle, statusMap);
    if (!recoveryInfo) return { isFatigued: false, targetColor: 0, intensityMult: 1 };

    const p = recoveryInfo.percentage;
    if (p <= 30) {
      return { isFatigued: true, targetColor: 0xFF0033, intensityMult: 1.5 };
    }
    if (p <= 75) {
      return { isFatigued: true, targetColor: 0xFFB300, intensityMult: 1.2 };
    }
    return { isFatigued: false, targetColor: 0, intensityMult: 1.0 };
  }

  private applyEmissiveToMaterial(m: THREE.MeshStandardMaterial, childUuid: string, basePulsedIntensity: number, statusMap: Map<string, MuscleStatus>): void {
    const muscle = this.meshMuscleMap.get(childUuid);
    const { isFatigued, targetColor, intensityMult } = this.computeMuscleEmissive(muscle, statusMap);

    if (isFatigued) {
      m.emissive.setHex(targetColor);
      m.emissiveIntensity = basePulsedIntensity * intensityMult;
    } else if (m.userData['originalEmissive'] !== undefined) {
      m.emissive.setHex(m.userData['originalEmissive']);
      m.emissiveIntensity = m.userData['originalIntensity'];
    }

    if (this.hoveredMesh() === childUuid) {
      if (!isFatigued) {
        m.emissive.setHex(0xCCFC7E);
      }
      m.emissiveIntensity = isFatigued ? m.emissiveIntensity + 0.5 : 0.5;
      m.opacity = Math.min(1.0, m.opacity + 0.4);
    }
  }

  private updateEmissiveMaterials(): void {
    const scene = this.modelScene();
    if (!scene) return;

    const basePulsedIntensity = 0.6 + Math.sin(this.elapsed * 3) * 0.35;
    const statusMap = this.recoveryService.getMuscleRecoveryStatus()();

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      
      const processMat = (mat: THREE.Material) => {
        if ((mat as any).isMeshStandardMaterial) {
          this.applyEmissiveToMaterial(mat as THREE.MeshStandardMaterial, child.uuid, basePulsedIntensity, statusMap);
        }
      };

      if (Array.isArray(child.material)) {
        child.material.forEach(processMat);
      } else if (child.material) {
        processMat(child.material);
      }
    });
  }
  onMeshClick(event: NgtThreeEvent<MouseEvent>): void {
    event.stopPropagation();
    const mesh = event.object as THREE.Mesh;
    const meshName = this.meshMuscleMap.get(mesh.uuid);
    const muscle = meshName ? this.recoveryService.getStatusForMesh(meshName)?.name : undefined;
    if (muscle) {
       this.recoveryService.setSelectedMuscle(muscle);
       
       // Proyección 2D para el Tooltip
       const camera = this.store.snapshot.camera;
       const gl = this.store.snapshot.gl;
       if (camera && gl && event.point) {
           const vector = event.point.clone();
           vector.project(camera);
           
           const canvas = gl.domElement;
           const rect = canvas.getBoundingClientRect();
           
           const x = ((vector.x + 1) / 2) * rect.width + rect.left;
           const y = (-(vector.y - 1) / 2) * rect.height + rect.top;
           
           this.tooltipData.emit({ muscle, x, y });
       }
    } else {
       this.tooltipData.emit(null);
    }
  }

  onPointerOver(event: NgtThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    const mesh = event.object as THREE.Mesh;
    if (this.meshMuscleMap.has(mesh.uuid)) {
        document.body.style.cursor = 'pointer';
        this.hoveredMesh.set(mesh.uuid);
    }
  }

  onPointerOut(event: NgtThreeEvent<PointerEvent>): void {
    const mesh = event.object as THREE.Mesh;
    if (this.hoveredMesh() === mesh.uuid) {
        document.body.style.cursor = 'default';
        this.hoveredMesh.set(null);
    }
  }
}
