import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  effect,
  signal,
  Injector,
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CommonModule } from '@angular/common';
import { extend, beforeRender, injectLoader, NgtRenderState, NgtThreeEvent, NgtArgs } from 'angular-three';
import { RecoveryService } from '../../../core/services/recovery.service';

extend(THREE);

/** Manual mapping for generic mesh names (e.g., 'Object_2') to internal muscle keys */
const MESH_MAP: Record<string, string> = {
  'Object_2': 'Pecho',
  'Object_3': 'Bíceps',
  'Object_4': 'Cuádriceps',
  'Object_5': 'Espalda',
  // Add more mappings as they are identified in the console
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
  // 1. Check manual mapping first
  if (MESH_MAP[meshName]) return MESH_MAP[meshName];

  // 2. Fallback to regex patterns
  for (const [pattern, muscle] of MESH_TO_MUSCLE) {
    if (pattern.test(meshName)) return muscle;
  }
  return null;
}

@Component({
  selector: 'app-biometric-model',
  standalone: true,
  imports: [CommonModule, NgtArgs],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!-- Cinematic holographic lighting rig -->
    <ngt-ambient-light [intensity]="0.4" color="#001830"></ngt-ambient-light>
    <ngt-directional-light
      [position]="[0, 8, 4]"
      [intensity]="1.5"
      color="#00AFFF">
    </ngt-directional-light>
    <ngt-point-light [position]="[2, 3, 3]"  [intensity]="6"  color="#00D2FF" [distance]="20" [decay]="2"></ngt-point-light>
    <ngt-point-light [position]="[-2, 3, 3]" [intensity]="6"  color="#00D2FF" [distance]="20" [decay]="2"></ngt-point-light>
    <ngt-point-light [position]="[0, -2, 2]" [intensity]="3"  color="#0055AA" [distance]="15" [decay]="2"></ngt-point-light>
    <ngt-point-light [position]="[0, 2, -4]" [intensity]="4"  color="#003366" [distance]="15" [decay]="2"></ngt-point-light>

    <!-- GLTF model primitive — rendered safely -->
    @if (gltfReady() && modelScene()) {
      <ngt-group
        [position]="modelOffset"
        [scale]="modelScale"
        (click)="onMeshClick($event)">
        <ngt-primitive *args="[modelScene()]" />
      </ngt-group>
    }
  `,
})
export class BiometricModelComponent {
  private readonly recoveryService = inject(RecoveryService);
  private readonly injector = inject(Injector);

  // GLTF via injectLoader (returns Signal<GLTF & NgtObjectMap | null>)
  private readonly gltf = injectLoader(
    (urls) => GLTFLoader,
    () => 'assets/models/human-anatomy.glb'
  );

  gltfReady = signal(false);
  loadError = signal(false);
  modelScene = signal<THREE.Group | null>(null);

  // Runtime state
  private elapsed = 0;
  private scanDir = 1;
  private scanY = -1.2;

  // Position / scale tweaks — FINAL PRECISION ALIGNMENT
  readonly modelOffset: [number, number, number] = [0, 0, 0];
  readonly modelScale: [number, number, number] = [75, 75, 75];

  // Map from mesh UUID → muscle name (populated on model load)
  private readonly meshMuscleMap = new Map<string, string>();

  constructor() {
    // Watch GLTF signal and apply holographic materials safely
    effect(() => {
      try {
        const result = this.gltf();
        if (!result) return;

        const scene = result.scene as THREE.Group;
        if (!scene) {
          console.warn('[BiometricModel] GLTF loaded but scene is null');
          return;
        }

        this.applyHolographicMaterials(scene);
        this.modelScene.set(scene);
        this.gltfReady.set(true);
        this.loadError.set(false);
        console.log('[BiometricModel] GLB successfully processed');
      } catch (err) {
        console.error('[BiometricModel] Critical error during GLTF processing:', err);
        this.loadError.set(true);
      }
    });

    beforeRender(({ delta }: NgtRenderState) => {
      this.elapsed += delta;
      
      // Auto-rotation
      const scene = this.modelScene();
      if (scene) {
        scene.rotation.y += delta * 0.5;
      }

      this.scanY += delta * 0.8 * this.scanDir;
      if (this.scanY > 1.6)  this.scanDir = -1;
      if (this.scanY < -1.2) this.scanDir = 1;

      this.updateEmissiveMaterials();
    });
  }

  // ─── Material application ────────────────────────────────────────────────

  private applyHolographicMaterials(scene: THREE.Group): void {
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const meshName = child.name;
      console.log('Mesh name detected:', meshName);

      // SPECIFIC TARGETING: Body and Eyes
      const isTarget = meshName.includes('body_low') || meshName.includes('Eye');
      
      if (!isTarget) {
        child.visible = false; // Hide clutter meshes
        return;
      }

      const muscle = resolveMuscleFromMeshName(meshName);
      if (muscle) {
        this.meshMuscleMap.set(child.uuid, muscle);
      }

      // Force holographic override — STRICT MEDICAL SCANNER STYLE
      child.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#00D2FF'),
        emissive: new THREE.Color('#004466'),
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.3,
        wireframe: true,
        roughness: 0.1,
        metalness: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      child.castShadow = false;
      child.receiveShadow = false;
    });
  }

  // ─── Per-frame emissive update ───────────────────────────────────────────

  private updateEmissiveMaterials(): void {
    const scene = this.modelScene();
    if (!scene) return;

    const statusMap = this.recoveryService.muscleRecoveryStatus();
    const t = this.elapsed;

    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const mat = child.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.isMeshStandardMaterial) return;

      const muscle = this.meshMuscleMap.get(child.uuid);
      const status = muscle ? statusMap.get(muscle) : null;

      if (status) {
        // Fatigue-based emissive color
        const emissiveHex = this.fatigueColor(status.percentage);
        mat.emissive.setHex(emissiveHex);
        mat.emissiveIntensity = this.fatigueIntensity(status.percentage, t);
        mat.opacity = 0.65 + Math.sin(t * 3.5) * 0.1;
      } else {
        // Unmapped mesh: gentle holographic base pulse
        mat.emissive.setHex(0x001a33);
        mat.emissiveIntensity = 0.4 + Math.sin(t * 2.2 + child.id * 0.7) * 0.2;
        mat.opacity = 0.3 + Math.sin(t * 1.8) * 0.08;
      }
    });
  }

  private fatigueColor(pct: number): number {
    if (pct <= 30) return 0xff0022;  // Critical — Red
    if (pct <= 75) return 0xff9900;  // Compromised — Amber
    return 0x00ccff;                 // Optimal — Cyan
  }

  private fatigueIntensity(pct: number, t: number): number {
    if (pct <= 30) {
      return 2.5 + Math.sin(t * 18) * 2.5; // Rapid flicker
    }
    if (pct <= 75) {
      return 1.2 + Math.sin(t * 6) * 0.8;
    }
    return 0.8 + Math.sin(t * 3) * 0.5;
  }

  // ─── Event handlers ──────────────────────────────────────────────────────

  onMeshClick(event: NgtThreeEvent<MouseEvent>): void {
    event.stopPropagation();
    
    const mesh = event.object as THREE.Mesh;
    if (!mesh) return;

    const muscle = this.meshMuscleMap.get(mesh.uuid);
    if (muscle) {
      console.log(`[BiometricModel] User clicked muscle: ${muscle}`);
      this.recoveryService.setSelectedMuscle(muscle);
    } else {
      // Try traversal up the hierarchy
      let parent = mesh.parent;
      while (parent) {
        const parentMuscle = this.meshMuscleMap.get(parent.uuid);
        if (parentMuscle) {
          this.recoveryService.setSelectedMuscle(parentMuscle);
          break;
        }
        parent = parent.parent;
      }
    }
  }
}
