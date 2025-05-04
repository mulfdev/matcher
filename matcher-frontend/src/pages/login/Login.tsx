import { GoogleLogin } from '@react-oauth/google';
import { NavLink, useNavigate } from 'react-router';
import { apiUrl, fetcher } from '~/core';
import { GoogleAuthRes } from '~/types';

export default function Login() {
  let navigate = useNavigate();

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
            <h2 className="text-3xl font-bold text-white">Welcome</h2>
            <p className="mt-2 text-gray-300">Sign in to continue to Matcher</p>
          </div>

          <div className="mt-8 space-y-6">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                await fetcher<GoogleAuthRes>({
                  method: 'POST',
                  url: `${apiUrl}/auth/google`,
                  body: {
                    credential: credentialResponse.credential,
                  },
                });
                console.log(credentialResponse);
                //navigate('/dashboard');
              }}
              onError={() => {
                console.log('Login Failed');
              }}
              useOneTap
            />
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-6 py-4 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Matcher. All rights reserved.
      </footer>
    </div>
  );
}
