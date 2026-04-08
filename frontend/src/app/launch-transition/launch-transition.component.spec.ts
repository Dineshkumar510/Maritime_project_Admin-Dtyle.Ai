import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LaunchTransitionComponent } from './launch-transition.component';

describe('LaunchTransitionComponent', () => {
  let component: LaunchTransitionComponent;
  let fixture: ComponentFixture<LaunchTransitionComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LaunchTransitionComponent]
    });
    fixture = TestBed.createComponent(LaunchTransitionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
