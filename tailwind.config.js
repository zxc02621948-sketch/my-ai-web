/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // 等級顏色 - 確保 Tailwind JIT 生成這些類
    'bg-gray-500',
    'bg-green-500',
    'bg-blue-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-orange-500',
    'bg-red-600',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
}
