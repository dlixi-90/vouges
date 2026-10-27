import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXElement[openingElement.selfClosing=false][openingElement.name.name=/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/]',
          message: 'Void HTML elements must be self-closing (for example, <br />) and cannot contain content.',
        },
      ],
    },
  },
])
