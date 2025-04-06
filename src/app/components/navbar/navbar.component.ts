import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    RouterLink,
    MatIconModule,
    MatMenuModule
  ],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  isMobile = false;

  // Inyectamos el servicio
  private breakpointObserver = inject(BreakpointObserver);

  constructor() {
    // Observamos si el ancho es de tipo "Handset" (teléfono móvil)
    this.breakpointObserver.observe([Breakpoints.Handset])
      .subscribe(result => {
        this.isMobile = result.matches;
      });
  }
}
