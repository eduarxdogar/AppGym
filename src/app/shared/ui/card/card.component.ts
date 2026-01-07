import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" [ngClass]="customClass">
      <div class="card-header" *ngIf="title">
        <h3>{{ title }}</h3>
        <ng-content select="[header]"></ng-content>
      </div>
      <div class="card-body">
        <ng-content></ng-content>
      </div>
      <div class="card-footer" *ngIf="hasFooter">
        <ng-content select="[footer]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      padding: 1rem;
      border-bottom: 1px solid #f0f0f0;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-body {
      padding: 1rem;
      flex: 1;
    }
    .card-footer {
      padding: 1rem;
      background: #f9f9f9;
      border-top: 1px solid #f0f0f0;
    }
  `]
})
export class CardComponent {
  @Input() title: string = '';
  @Input() customClass: string = '';
  @Input() hasFooter: boolean = false;
}
