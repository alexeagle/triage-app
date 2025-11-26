export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-4">Triage App</h1>
      <p className="text-gray-600 mb-6">Please log in to continue.</p>
      <a
        href="/api/auth/signin"
        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Sign in with GitHub
      </a>
    </div>
  );
}
