import { NavLink } from 'react-router';

export default function Home() {
  console.log(`API URL: ${import.meta.env.VITE_API_URL}`);
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Navbar */}
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
          Matcher
        </div>
        <div>
          <NavLink
            to="/login"
            className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Login
          </NavLink>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-6 flex flex-col items-center justify-center text-center flex-grow">
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
              Matcher
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-10 text-balance">
            AI-powered precision that connects your resume to your dream job. Stop searching, start
            matching.
          </p>

          <NavLink
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 text-lg font-medium rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all"
          >
            Get Started
          </NavLink>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-4 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Matcher. All rights reserved.
      </footer>
    </div>
  );
}
