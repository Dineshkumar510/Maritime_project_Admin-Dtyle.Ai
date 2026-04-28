import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectionStrategy,
  signal,
  ViewChild,
  ElementRef,
  NgZone,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  form!: FormGroup;
  loading = signal(false);
  error = signal('');
  hidePass = signal(true);
  returnUrl = '/dashboard';

  readonly year = new Date().getFullYear();

  @ViewChild('card') private cardRef!: ElementRef<HTMLDivElement>;
  @ViewChild('bgCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private _destroyThree?: () => void;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone,
  ) {}


  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate([this.returnUrl]);
      return;
    }

    this.returnUrl =
      this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';

    this.form = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(1)]],
    });

    const urlError = this.route.snapshot.queryParamMap.get('error');
    if (urlError === 'session_expired') {
      this.error.set('Your session has expired. Please sign in again.');
    }
  }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => this._initThreeJS());
  }

  ngOnDestroy(): void {
    this._destroyThree?.();
  }


  get f() {
    return this.form.controls;
  }

  onTilt(event: MouseEvent): void {
    const card = this.cardRef?.nativeElement;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transition =
      'transform 0.08s ease-out, box-shadow 0.08s ease-out';
    card.style.transform = `perspective(1100px) rotateY(${x * 16}deg) rotateX(${-y * 11}deg) translateZ(18px)`;
    card.style.boxShadow = [
      `${-x * 30}px ${y * 15}px 50px rgba(0,100,200,0.14)`,
      `0 24px 70px rgba(0,70,150,0.12)`,
      `${-x * 12}px ${y * 6}px 24px rgba(0,150,210,0.08)`,
      `inset 0 1px 0 rgba(255,255,255,0.95)`,
    ].join(', ');
  }

  resetTilt(): void {
    const card = this.cardRef?.nativeElement;
    if (!card) return;
    card.style.transition =
      'transform 0.55s cubic-bezier(0.23,1,0.32,1), box-shadow 0.55s cubic-bezier(0.23,1,0.32,1)';
    card.style.transform =
      'perspective(1100px) rotateY(0deg) rotateX(0deg) translateZ(0px)';
    card.style.boxShadow =
      '0 20px 60px rgba(0,80,160,0.1), 0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)';
  }


  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    const { username, password } = this.form.value;

    this.auth.login(username.trim(), password).subscribe({
      next: () => {
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Sign in failed. Please try again.');
      },
    });
  }


  private _initThreeJS(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    let destroyed = false;
    let animId = 0;

    let renderer: any, scene: any, camera: any;
    let waveMesh: any, waveMesh2: any, particles: any;
    let sphere1: any, sphere2: any, torus: any, octa: any, icosa: any;
    let mouseX = 0,
      mouseY = 0;

    const loadThree = (): Promise<any> =>
      new Promise((resolve) => {
        if ((window as any)['THREE']) {
          resolve((window as any)['THREE']);
          return;
        }
        const s = document.createElement('script');
        s.src =
          'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        s.onload = () => resolve((window as any)['THREE']);
        document.head.appendChild(s);
      });

    const init = async () => {
      const T = await loadThree();
      if (destroyed) return;

      scene = new T.Scene();
      camera = new T.PerspectiveCamera(
        52,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      camera.position.set(0, 30, 68);
      camera.lookAt(0, 0, 0);

      renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      const storeXY = (geo: any): Float32Array => {
        const pos = geo.attributes.position;
        const xy = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          xy[i * 2] = pos.getX(i);
          xy[i * 2 + 1] = pos.getY(i);
        }
        return xy;
      };

      const wGeo = new T.PlaneGeometry(165, 115, 65, 45);
      waveMesh = new T.Mesh(
        wGeo,
        new T.MeshBasicMaterial({
          color: 0x1878b8,
          wireframe: true,
          transparent: true,
          opacity: 0.13,
        }),
      );
      waveMesh.rotation.x = -Math.PI / 2;
      waveMesh.position.y = -14;
      waveMesh.userData.xy = storeXY(wGeo);
      scene.add(waveMesh);

      const wGeo2 = new T.PlaneGeometry(165, 115, 32, 22);
      waveMesh2 = new T.Mesh(
        wGeo2,
        new T.MeshBasicMaterial({
          color: 0x00a8c8,
          wireframe: true,
          transparent: true,
          opacity: 0.07,
        }),
      );
      waveMesh2.rotation.x = -Math.PI / 2;
      waveMesh2.position.y = -10;
      waveMesh2.userData.xy = storeXY(wGeo2);
      scene.add(waveMesh2);

      const pCount = 220;
      const pGeo = new T.BufferGeometry();
      const pPos = new Float32Array(pCount * 3);
      const pPhase = new Float32Array(pCount);
      for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 135;
        pPos[i * 3 + 1] = Math.random() * 38 - 5;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 95;
        pPhase[i] = Math.random() * Math.PI * 2;
      }
      pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
      pGeo.setAttribute('phase', new T.BufferAttribute(pPhase, 1));
      particles = new T.Points(
        pGeo,
        new T.PointsMaterial({
          color: 0x1070b0,
          size: 0.4,
          transparent: true,
          opacity: 0.5,
        }),
      );
      scene.add(particles);

      sphere1 = new T.Mesh(
        new T.SphereGeometry(18, 20, 20),
        new T.MeshBasicMaterial({
          color: 0x3898c8,
          wireframe: true,
          transparent: true,
          opacity: 0.07,
        }),
      );
      sphere1.position.set(-45, 6, -18);
      scene.add(sphere1);

      sphere2 = new T.Mesh(
        new T.SphereGeometry(9, 14, 14),
        new T.MeshBasicMaterial({
          color: 0x28b8a0,
          wireframe: true,
          transparent: true,
          opacity: 0.09,
        }),
      );
      sphere2.position.set(46, 12, -28);
      scene.add(sphere2);

      torus = new T.Mesh(
        new T.TorusGeometry(11, 0.35, 10, 48),
        new T.MeshBasicMaterial({
          color: 0x1888c0,
          wireframe: true,
          transparent: true,
          opacity: 0.11,
        }),
      );
      torus.position.set(32, 6, -8);
      torus.rotation.x = Math.PI / 2.8;
      scene.add(torus);

      octa = new T.Mesh(
        new T.OctahedronGeometry(5.5, 1),
        new T.MeshBasicMaterial({
          color: 0x2090c8,
          wireframe: true,
          transparent: true,
          opacity: 0.1,
        }),
      );
      octa.position.set(-24, 10, 18);
      scene.add(octa);

      icosa = new T.Mesh(
        new T.IcosahedronGeometry(4, 1),
        new T.MeshBasicMaterial({
          color: 0x00a898,
          wireframe: true,
          transparent: true,
          opacity: 0.09,
        }),
      );
      icosa.position.set(14, 18, 10);
      scene.add(icosa);

      const clock = new T.Clock();

      const animate = () => {
        if (destroyed) return;
        animId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        const wp = waveMesh.geometry.attributes.position;
        const xy = waveMesh.userData.xy as Float32Array;
        for (let i = 0; i < wp.count; i++) {
          const x = xy[i * 2],
            y = xy[i * 2 + 1];
          wp.setZ(
            i,
            Math.sin(x * 0.075 + t * 0.55) * 2.8 +
              Math.sin(y * 0.095 + t * 0.45) * 2.2 +
              Math.sin(x * 0.13 + y * 0.085 + t * 0.38) * 1.6,
          );
        }
        wp.needsUpdate = true;

        const wp2 = waveMesh2.geometry.attributes.position;
        const xy2 = waveMesh2.userData.xy as Float32Array;
        for (let i = 0; i < wp2.count; i++) {
          const x = xy2[i * 2],
            y = xy2[i * 2 + 1];
          wp2.setZ(
            i,
            Math.sin(x * 0.06 + t * 0.42 + 1.2) * 3.2 +
              Math.sin(y * 0.08 + t * 0.36 + 0.7) * 2.6,
          );
        }
        wp2.needsUpdate = true;

        const pp = particles.geometry.attributes.position;
        const ph = particles.geometry.attributes.phase;
        for (let i = 0; i < pCount; i++) {
          pp.setY(i, pp.getY(i) + Math.sin(t * 0.6 + ph.getX(i)) * 0.007);
        }
        pp.needsUpdate = true;

        // Rotate objects
        sphere1.rotation.y = t * 0.05;
        sphere1.rotation.x = t * 0.025;
        sphere2.rotation.y = -t * 0.06;
        sphere2.rotation.z = t * 0.035;
        torus.rotation.z = t * 0.07;
        octa.rotation.y = t * 0.09;
        octa.rotation.x = t * 0.05;
        icosa.rotation.y = t * 0.11;
        icosa.rotation.z = t * 0.07;

        // Smooth mouse parallax on camera
        camera.position.x += (mouseX * 14 - camera.position.x) * 0.028;
        camera.position.y += (-mouseY * 7 + 30 - camera.position.y) * 0.028;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      };

      animate();

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      window.addEventListener('resize', onResize);
      window.addEventListener('mousemove', onMouseMove);

      // Store cleanup fn
      this._destroyThree = () => {
        destroyed = true;
        cancelAnimationFrame(animId);
        renderer?.dispose();
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mousemove', onMouseMove);
      };
    };

    init();
  }
}
