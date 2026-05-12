import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  effect,
  signal,
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CommonModule } from '@angular/common';
import { extend, beforeRender, injectLoader, NgtRenderState, NgtThreeEvent, NgtArgs } from 'angular-three';
import { MatIconModule } from '@angular/material/icon';
import { RecoveryService } from '../../../core/services/recovery.service';
import { UserProfileStateService } from '../../../core/services/user-profile-state.service';

extend(THREE);

/** Manual mapping for generic mesh names (e.g., 'Object_2') to internal muscle keys */
const MESH_MAP: Record<string, string> = {
  'Object_2': 'Pecho',
  'Object_3': 'Bíceps',
  'Object_4': 'Cuádriceps',
  'Object_5': 'Espalda',
};

/** Maps GLB mesh names (partial, case-insensitive) → internal muscle key */
const MESH_TO_MUSCLE: Array<[RegExp, string]> = [
  [/pector|chest|pecho/i, 'Pecho'],
  [/lat|dorsal|espalda|back/i, 'Espalda'],
  [/delt|shoulder|hombro/i, 'Hombros'],
  [/bicep|b.cep/i, 'Bíceps'],
  [/tricep|tr.cep/i, 'Tríceps'],
  [/forearm|antebrazo/i, 'Antebrazos'],
  [/quad|cuadric|thigh|muslo/i, 'Cuádriceps'],
  [/hamstr|isqui|femor/i, 'Isquios'],
  [/glute|gl.teo|gluteus/i, 'Glúteos'],
  [/calf|gemelo|gastro/i, 'Gemelos'],
  [/abdom|core|abs|rectus/i, 'Core'],
  [/trap|trapecio/i, 'Trapecio'],
  [/lumbar|erector|lumbare/i, 'Lumbares'],
];

function resolveMuscleFromMeshName(meshName: string): string | null {
  if (MESH_MAP[meshName]) return MESH_MAP[meshName];
  for (const [pattern, muscle] of MESH_TO_MUSCLE) {
    if (pattern.test(meshName)) return muscle;
  }
  return null;
}

@Component({
  selector: 'app-biometric-model',
  standalone: true,
  imports: [CommonModule, NgtArgs, MatIconModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!-- Cinematic holographic lighting rig -->
    <ngt-ambient-light [intensity]="0.3" color="#001830"></ngt-ambient-light>
    <ngt-directional-light [position]="[0, 8, 4]" [intensity]="1.2" color="#00f3ff"></ngt-directional-light>
    <ngt-point-light [position]="[2, 3, 3]" [intensity]="8" color="#00f3ff" [distance]="20" [decay]="2"></ngt-point-light>
    <ngt-point-light [position]="[-2, 3, 3]" [intensity]="8" color="#00f3ff" [distance]="20" [decay]="2"></ngt-point-light>
    <ngt-point-light [position]="[0, -2, 2]" [intensity]="3" color="#0044cc" [distance]="15" [decay]="2"></ngt-point-light>
    <ngt-point-light [position]="[0, 2, -4]" [intensity]="4" color="#003366" [distance]="15" [decay]="2"></ngt-point-light>

    <!-- GLTF model primitive -->
    @if (gltfReady() && modelScene()) {
      <ngt-group
        [position]="modelOffset"
        [scale]="modelScale"
        (click)="onMeshClick($event)">
        <ngt-primitive *args="[modelScene()]" [dispose]="null" />
      </ngt-group>
    }
  `,
})
export class BiometricModelComponent {
  private readonly recoveryService = inject(RecoveryService);
  private readonly profileState = inject(UserProfileStateService);

  profile = this.profileState.profile;

  private readonly gltf = injectLoader(
    () => GLTFLoader,
    () => 'assets/models/human-anatomy.glb'
  );

  gltfReady = signal(false);
  loadError = signal(false);
  modelScene = signal<THREE.Group | null>(null);

  private elapsed = 0;
  readonly modelOffset: [number, number, number] = [0, 10, 0];
  readonly modelScale: [number, number, number] = [150, 130, 100];
  private readonly meshMuscleMap = new Map<string, string>();

  constructor() {
    effect(() => {
      try {
        const result = this.gltf() as any;
        if (!result || !result.scene) return;
        const scene = result.scene as THREE.Group;
        if (!scene) return;

        this.applyHolographicMaterials(scene);
        this.modelScene.set(scene);
        this.gltfReady.set(true);
      } catch (err) {
        console.error('[BiometricModel] error:', err);
        this.loadError.set(true);
      }
    });

    beforeRender(({ delta }: NgtRenderState) => {
      this.elapsed += delta;
      const scene = this.modelScene();
      if (scene) scene.rotation.y += delta * 0.4;
      this.updateEmissiveMaterials();
    });
  }

  private applyHolographicMaterials(scene: THREE.Group): void {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const meshName = child.name;
      const isTarget = meshName.includes('body_low') || meshName.includes('Eye');
      if (!isTarget) {
        child.visible = false;
        return;
      }
      const muscle = resolveMuscleFromMeshName(meshName);
      if (muscle) this.meshMuscleMap.set(child.uuid, muscle);

      child.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#00040d'),
        emissive: new THREE.Color('#00f3ff'), // Cian holográfico base
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.3,
        wireframe: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        roughness: 0.1,
        metalness: 0.5,
      });
    });
  }

  private updateEmissiveMaterials(): void {
    const scene = this.modelScene();
    if (!scene) return;

    const inbody = this.profile()?.inbodyData;
    const t = this.elapsed;

    // Opacidad ligada al agua corporal (más agua = holograma más sólido)
    const waterFactor = inbody?.waterPercentage
      ? Math.min(1, inbody.waterPercentage / 70) // 70% de agua = 100% opacity
      : 0.45;

    // Pulso suave constante cian holográfico
    const pulsedOpacity = (0.15 + waterFactor * 0.45) + Math.sin(t * 2.2) * 0.06;
    const pulsedIntensity = 0.6 + Math.sin(t * 3) * 0.35;

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      if (!mat?.isMeshStandardMaterial) return;

      mat.opacity = pulsedOpacity;
      mat.emissiveIntensity = pulsedIntensity;
    });
  }
  onMeshClick(event: NgtThreeEvent<MouseEvent>): void {
    event.stopPropagation();
    const mesh = event.object as THREE.Mesh;
    const muscle = this.meshMuscleMap.get(mesh.uuid);
    if (muscle) this.recoveryService.setSelectedMuscle(muscle);
  }
}
