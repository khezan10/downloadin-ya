import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

/**
 * Flat ESLint config.
 *
 * The plugin set is deliberately small: eslint-config-next pulls in
 * fast-glob -> micromatch -> braces, and the current braces advisory
 * (<= 3.0.3, no patched release yet) makes `npm audit` report five high
 * severity issues for what is only a lint-time glob parser. These plugins
 * cover the same ground without that dependency chain.
 */
export default [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'public/**', '.vercel/**'],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
      // eslint-plugin-jsx-a11y ships no flat config; the rule set is the same.
      ...jsxA11y.configs.recommended.rules,

      // The app is a Next.js App Router project: every component is a client
      // component, so the React import is not needed to use hooks.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // Unused arguments are fine when a signature has to match an interface.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Console output is fine in server-side code, but flag it in the app.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Tests deliberately feed junk into the helpers.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
