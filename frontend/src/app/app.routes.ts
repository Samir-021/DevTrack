
import { Routes } from '@angular/router';
import { Projects } from './projects/projects';
import { Tasks } from './pages/tasks/tasks';
import { Dashboard } from './pages/dashboard/dashboard';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { AppLayout } from './layout/app-layout/app-layout';
import { authGuard } from './guards/auth-guard';
import { Profile } from './pages/profile/profile';

export const routes: Routes = [
  {
    path: 'login',
    component: Login
  },
  {
    path: 'register',
    component: Register
  },
  {
    path: '',
    component: AppLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        component: Dashboard
      },
      {
        path: 'projects',
        component: Projects
      },
      {
        path: 'tasks',
        component: Tasks
      },
      { path: 'profile', component: Profile },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
