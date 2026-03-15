module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint', 'unused-imports'],
  rules: {
    // Use plugin to error on unused imports and provide autofix where possible
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: true }],
    // Disable the default TS rule to avoid duplicate warnings
    '@typescript-eslint/no-unused-vars': 'off'
  },
  ignorePatterns: ['dist/', 'node_modules/', '.git/']
}
