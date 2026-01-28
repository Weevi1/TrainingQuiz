/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic CSS variables for white-label theming
        // Core colors
        primary: {
          DEFAULT: 'var(--primary-color)',
          light: 'var(--primary-light-color)',
          dark: 'var(--primary-dark-color)',
        },
        secondary: {
          DEFAULT: 'var(--secondary-color)',
          light: 'var(--secondary-light-color)',
          dark: 'var(--secondary-dark-color)',
        },
        accent: 'var(--accent-color)',

        // Background colors
        background: 'var(--background-color)',
        surface: {
          DEFAULT: 'var(--surface-color)',
          hover: 'var(--surface-hover-color)',
        },

        // Text colors
        text: {
          DEFAULT: 'var(--text-color)',
          secondary: 'var(--text-secondary-color)',
          'on-primary': 'var(--text-on-primary-color)',
          'on-secondary': 'var(--text-on-secondary-color)',
        },

        // Feedback colors
        success: {
          DEFAULT: 'var(--success-color)',
          light: 'var(--success-light-color)',
        },
        error: {
          DEFAULT: 'var(--error-color)',
          light: 'var(--error-light-color)',
        },
        warning: {
          DEFAULT: 'var(--warning-color)',
          light: 'var(--warning-light-color)',
        },

        // Game colors
        'game-accent': 'var(--game-accent-color)',
        streak: 'var(--streak-color)',
        celebration: 'var(--celebration-color)',

        // Border
        border: 'var(--border-color)',

        // Game-specific colors
        millionaire: {
          accent: 'var(--millionaire-accent)',
        },
        bingo: {
          marked: 'var(--bingo-marked-cell)',
          win: 'var(--bingo-win-highlight)',
        },
        speedround: {
          urgent: 'var(--speedround-urgent)',
        },
      },
      fontFamily: {
        brand: 'var(--font-family)',
        heading: 'var(--font-family-heading)',
      },
      fontWeight: {
        'brand-normal': 'var(--font-weight-normal)',
        'brand-medium': 'var(--font-weight-medium)',
        'brand-bold': 'var(--font-weight-bold)',
      },
      borderRadius: {
        brand: 'var(--border-radius)',
      },
      boxShadow: {
        brand: 'var(--shadow-style)',
      },
      backgroundImage: {
        // Game container gradients
        'millionaire': 'var(--millionaire-container-gradient)',
        'millionaire-question': 'var(--millionaire-question-bg)',
        'bingo': 'var(--bingo-container-gradient)',
        'speedround': 'var(--speedround-container-gradient)',
      },
      backgroundColor: {
        // Game-specific backgrounds
        'millionaire-ladder': 'var(--millionaire-money-ladder-bg)',
        'millionaire-lifeline': 'var(--millionaire-lifeline-bg)',
        'bingo-card': 'var(--bingo-card-bg)',
        'speedround-timer': 'var(--speedround-timer-bg)',
        'speedround-question': 'var(--speedround-question-bg)',
        'spotdiff-container': 'var(--spotdiff-container-bg)',
        'spotdiff-document': 'var(--spotdiff-document-bg)',
        'spotdiff-highlight': 'var(--spotdiff-highlight)',
        'spotdiff-found': 'var(--spotdiff-found)',
      },
    },
  },
  plugins: [],
}
