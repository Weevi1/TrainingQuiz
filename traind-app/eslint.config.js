import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Catch TDZ-style bugs where a `const`/`let` is referenced earlier in
      // its own scope than it's declared. TypeScript's ts(2448) misses the
      // in-function-body case (it lets you read a hoisted `const` from the
      // top of the same function), so we need the lint rule to fill the gap.
      // This would have caught the `entries`/`hasPodium` ordering bug.
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: false, classes: false, variables: true, enums: true, typedefs: false, ignoreTypeReferences: true },
      ],
    },
  },
])
