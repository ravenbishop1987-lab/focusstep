import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:     '#f0ede6',
        card:   '#ffffff',
        subtle: '#e8f0e8',
        chip:   '#eaf2eb',
        accent: {
          DEFAULT: '#4a7c59',
          dark:    '#3d6b47',
          border:  '#7ab88a',
          light:   '#b8d4b8',
        },
        ink: {
          DEFAULT: '#2c2a22',
          body:    '#5a5448',
          muted:   '#7a7568',
          faint:   '#a09a8e',
          ghost:   '#b0a898',
        },
        border: {
          DEFAULT: '#d0cab8',
          card:    '#ddd8ce',
          chip:    '#c8c2b6',
          muted:   '#c5bfb0',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'serif'],
        sans:  ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
