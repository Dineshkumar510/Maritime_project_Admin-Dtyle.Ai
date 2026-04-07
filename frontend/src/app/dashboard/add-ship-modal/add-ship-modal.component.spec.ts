import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddShipModalComponent } from './add-ship-modal.component';

describe('AddShipModalComponent', () => {
  let component: AddShipModalComponent;
  let fixture: ComponentFixture<AddShipModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AddShipModalComponent]
    });
    fixture = TestBed.createComponent(AddShipModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
