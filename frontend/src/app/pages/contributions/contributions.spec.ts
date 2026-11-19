import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Contributions } from './contributions';

describe('Contributions', () => {
  let component: Contributions;
  let fixture: ComponentFixture<Contributions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Contributions],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Contributions);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
