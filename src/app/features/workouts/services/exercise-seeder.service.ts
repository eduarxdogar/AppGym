import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, setDoc, getDocs } from '@angular/fire/firestore';
import { ExerciseData } from '../models/exercise-catalog';
import { LoggerService } from '../../../core/services/logger.service';

@Injectable({
  providedIn: 'root'
})
export class ExerciseSeederService {
  private readonly firestore = inject(Firestore);
  private readonly logger = inject(LoggerService);
  private readonly injector = inject(Injector);

  async runSeeder(): Promise<void> {
    try {
      await runInInjectionContext(this.injector, async () => {
        const collectionRef = collection(this.firestore, 'global_exercises');
        
        // 1. Verify if empty
        const snapshot = await getDocs(collectionRef);
        if (!snapshot.empty) {
          this.logger.log('Catálogo de ejercicios ya existe en Firestore. (' + snapshot.size + ' ejercicios)');
          return;
        }

        // 2. Fetch external JSON
        this.logger.log('Descargando catálogo de ejercicios desde assets...');
        const response = await fetch('/assets/data/exercises-seed.json');
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        const exercises: ExerciseData[] = await response.json();

        this.logger.log('Iniciando carga masiva de catálogo (' + exercises.length + ' ejercicios)...');
        
        // 3. Upload catalog
        const promises = exercises.map(exercise => {
          const docId = exercise.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
          const docRef = doc(collectionRef, docId);
          return setDoc(docRef, { ...exercise, id: docId });
        });

        await Promise.all(promises);
        this.logger.log('✅ Catálogo de ejercicios cargado exitosamente.');
      });
    } catch (error) {
      this.logger.error('Error poblando el catálogo:', error);
    }
  }
}
