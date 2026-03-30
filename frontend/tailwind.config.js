/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            colors: {
                navy: {
                    950: '#0a0f1e',
                    900: '#0d1426',
                    800: '#111827',
                    700: '#1a2540',
                    600: '#1e2d4f',
                    500: '#253560',
                },
                accent: {
                    cyan: '#22d3ee',
                    blue: '#60a5fa',
                    green: '#4ade80',
                    amber: '#fbbf24',
                    red: '#f87171',
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'glow-cyan': 'radial-gradient(ellipse at center, rgba(34,211,238,0.15) 0%, transparent 70%)',
            },
            boxShadow: {
                'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
                'card-hover': '0 8px 40px rgba(0, 0, 0, 0.6)',
                'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.25)',
                'glow-blue': '0 0 20px rgba(96, 165, 250, 0.25)',
            },
            animation: {
                'fade-in': 'fadeIn 0.4s ease-out',
                'slide-in': 'slideIn 0.3s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideIn: {
                    '0%': { opacity: '0', transform: 'translateX(-8px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
            },
        },
    },
    plugins: [],
}
