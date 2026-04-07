import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { authGuard } from './guard/auth.guard';
import { LogoutComponent } from './logout/logout.component';
import { DashboardComponent } from './dashboard/dashboard.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
