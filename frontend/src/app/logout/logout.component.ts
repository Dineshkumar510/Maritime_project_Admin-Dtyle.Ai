import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css'],
})
export class LogoutComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.auth.handleSSOLogout();
    setTimeout(() => this.router.navigate(['/login']), 400);
  }
}
