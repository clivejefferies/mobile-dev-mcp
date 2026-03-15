module.exports = [
  // Files/directories to ignore
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.git/',
      '.vscode/',
      'coverage/',
      '.env'
    ]
  },
  // Apply rules to JS/TS source and tests
  {
    files: ['src/**/*.ts', 'test/**/*.ts', 'src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      parser: require.resolve('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      'unused-imports': require('eslint-plugin-unused-imports')
    },
    rules: {
      // Use plugin to error on unused imports and provide autofix where possible
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: true }],
      // Disable the default TS rule to avoid duplicate warnings
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
]
