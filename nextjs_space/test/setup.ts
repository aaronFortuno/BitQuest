import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock i18next — return the key as the translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts) return `${key}:${JSON.stringify(opts)}`
      return key
    },
    i18n: { language: 'ca', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// Mock framer-motion — render children directly
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, prop) => {
      // Return a forwardRef component for each HTML element (motion.div, motion.span, etc.)
      const Component = ({ children, ...props }: Record<string, unknown>) => {
        // Filter out framer-motion specific props
        const htmlProps: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(props)) {
          if (!['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileInView', 'layout', 'layoutId'].includes(key)) {
            htmlProps[key] = value
          }
        }
        // Use createElement to avoid JSX in a .ts file
        const { createElement } = require('react')
        return createElement(prop as string, htmlProps, children as unknown)
      }
      Component.displayName = `motion.${String(prop)}`
      return Component
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
  useInView: () => true,
}))
