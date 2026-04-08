import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent }          from './login/login.component';
import { LogoutComponent }         from './logout/logout.component';
import { DashboardComponent }      from './dashboard/dashboard.component';
import { ExternalViewerComponent } from './external-viewer/external-viewer.component';
import { authGuard }               from './guard/auth.guard';

const routes: Routes = [
  { path: 'login',    component: LoginComponent },
  { path: 'logout',   component: LogoutComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'external',
    component: ExternalViewerComponent,
    canActivate: [authGuard],
  },
  { path: '',   redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
