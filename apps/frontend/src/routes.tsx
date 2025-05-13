import { createBrowserRouter } from 'react-router';
import { lazy, Suspense } from 'react';
import DashboardLayout from '~/layouts/DashboardLayout';

const Login = lazy(() => import('~/pages/login/Login'));
const Home = lazy(() => import('~/pages/home/Home'));
const Dashboard = lazy(() => import('~/pages/dashboard/Dashboard'));
const DashboardMatches = lazy(() => import('~/pages/dashboard/Matches'));
const Profile = lazy(() => import('~/pages/dashboard/Profile'));

function withSuspense(Component: React.ComponentType) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: withSuspense(Home) },
  { path: 'login', element: withSuspense(Login) },
  {
    path: '/dashboard',
    Component: DashboardLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'matches', Component: DashboardMatches },
      { path: 'profile', Component: Profile },
    ],
  },
]);
