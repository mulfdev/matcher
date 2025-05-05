import { createBrowserRouter } from 'react-router';
import Login from '~/pages/login/Login';
import Home from '~/pages/home/Home';
import Dashboard from '~/pages/dashboard/Dashboard';
export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: 'login', element: <Login /> },
  { path: 'dashboard', element: <Dashboard /> },
]);
