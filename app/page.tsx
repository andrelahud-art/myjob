export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <main className="max-w-4xl text-center">
        <h1 className="mb-4 text-6xl font-bold text-gray-900">
          FixMyJob<span className="text-blue-600">.mx</span>
        </h1>
        <p className="mb-8 text-2xl text-gray-700">
          On-Demand Local Services for Tourists in Mexico
        </p>

        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="mb-2 text-4xl">🗺️</div>
            <h3 className="mb-2 font-semibold">Tour Guides</h3>
            <p className="text-sm text-gray-600">Expert local guides</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="mb-2 text-4xl">🚗</div>
            <h3 className="mb-2 font-semibold">Drivers</h3>
            <p className="text-sm text-gray-600">Safe transportation</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="mb-2 text-4xl">💬</div>
            <h3 className="mb-2 font-semibold">Translators</h3>
            <p className="text-sm text-gray-600">Multi-language support</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="mb-2 text-4xl">🎒</div>
            <h3 className="mb-2 font-semibold">Helpers</h3>
            <p className="text-sm text-gray-600">Any task assistance</p>
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <a
            href="/api/auth/signin"
            className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Find a Worker
          </a>
          <a
            href="/api/auth/signin"
            className="rounded-lg border-2 border-blue-600 px-8 py-3 font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            Become a Worker
          </a>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">How It Works</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <div className="mb-2 text-3xl font-bold text-blue-600">1</div>
              <h3 className="mb-2 font-semibold">Post Your Job</h3>
              <p className="text-sm text-gray-600">
                Describe what you need and when
              </p>
            </div>
            <div>
              <div className="mb-2 text-3xl font-bold text-blue-600">2</div>
              <h3 className="mb-2 font-semibold">Get Matched</h3>
              <p className="text-sm text-gray-600">
                Verified workers accept your job
              </p>
            </div>
            <div>
              <div className="mb-2 text-3xl font-bold text-blue-600">3</div>
              <h3 className="mb-2 font-semibold">Pay Safely</h3>
              <p className="text-sm text-gray-600">
                Secure escrow until job completion
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm text-gray-600">
            🏆 Ready for World Cup 2026 | 🔒 Secure Payments | ✅ KYC Verified Workers
          </p>
        </div>
      </main>
    </div>
  );
}
