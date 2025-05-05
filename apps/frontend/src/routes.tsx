import { createBrowserRouter } from 'react-router';
import Login from '~/pages/login/Login';
import Home from '~/pages/home/Home';
import Dashboard from '~/pages/dashboard/Dashboard';
import DashboardLayout from '~/layouts/DashboardLayout';
import DashboardMatches from '~/pages/dashboard/Matches';

export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: 'login', element: <Login /> },
  {
    path: "/dashboard",
    Component: DashboardLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "matches", Component: DashboardMatches }
    ]
  }])
