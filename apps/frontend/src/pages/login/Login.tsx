import { NavLink } from 'react-router';
import { apiUrl } from '~/core';

export default function Login() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <NavLink to="/">
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
            Matcher
          </div>
        </NavLink>
      </nav>

      <main className="container mx-auto px-6 flex flex-col items-center justify-center text-center flex-grow">
        <div className="w-full max-w-md p-8 space-y-8 bg-gray-900 rounded-xl shadow-lg">
          <div>
            <h2 className="text-3xl font-bold text-white">Welcome To Matcher!</h2>
          </div>

          <div className="mt-8 space-y-6">
            <h3>Sign in With</h3>
            <div className="flex w-full justify-center">
              <button
                onClick={() => {
                  window.location.href = `${apiUrl}/auth/google`;
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded w-48"
              >
                Google
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-6 py-4 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Matcher. All rights reserved.
      </footer>
    </div>
  );
}
