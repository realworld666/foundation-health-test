const globals = require('globals');

module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.es2022,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
    },
  },
];
