import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExternalViewerComponent } from './external-viewer.component';

describe('ExternalViewerComponent', () => {
  let component: ExternalViewerComponent;
  let fixture: ComponentFixture<ExternalViewerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ExternalViewerComponent]
    });
    fixture = TestBed.createComponent(ExternalViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
