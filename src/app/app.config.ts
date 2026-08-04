// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID, importProvidersFrom, ErrorHandler } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';

registerLocaleData(localeEsCo);
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

// Providers de Angular Material necesarios:
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFunctions, getFunctions } from '@angular/fire/functions';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { environment } from '../environments/environment';
import { provideNgtRenderer } from 'angular-three/dom';

import { MatNativeDateModule } from '@angular/material/core';
import { 
  LucideAngularModule, 
  Shield, RefreshCw, Users, UserCheck, UserX, CircleAlert, 
  UserMinus, FlaskConical, Trash2, TriangleAlert, ArrowLeft, 
  Search, Check, Info, Pencil, Settings, Play, House, 
  LayoutDashboard, Dumbbell, Calendar, LogOut, ChevronRight, 
  ChevronLeft, ChevronDown, ChevronUp, Plus, Activity
} from 'lucide-angular';

import { GlobalErrorHandler } from './core/errors/global-error-handler';
import { securityInterceptor } from './core/interceptors/security.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimations(),                      // Necesario para Angular Material
    provideHttpClient(withInterceptors([securityInterceptor])),                      // Para peticiones HTTP
    importProvidersFrom(MatNativeDateModule), // Para el Datepicker
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
    provideFunctions(() => getFunctions()),
    provideStorage(() => getStorage()),
    provideNgtRenderer(),
    provideCharts(withDefaultRegisterables()),
    importProvidersFrom(
      LucideAngularModule.pick({
        Shield, RefreshCw, Users, UserCheck, UserX, CircleAlert, 
        UserMinus, FlaskConical, Trash2, TriangleAlert, ArrowLeft, 
        Search, Check, Info, Pencil, Settings, Play, House, 
        LayoutDashboard, Dumbbell, Calendar, LogOut, ChevronRight, 
        ChevronLeft, ChevronDown, ChevronUp, Plus, Activity
      })
    ),
    { provide: LOCALE_ID, useValue: 'es-CO' }
  ]
};
