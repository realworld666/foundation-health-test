const { getTsconfig } = require('get-tsconfig');
const path = require('path');

const ecmaVersion = 2022;

const tsconfig = getTsconfig();
if (tsconfig == null) {
  throw new Error('Unable to find tsconfig.json');
}

module.exports = {
  extends: ['eslint:recommended', 'plugin:import/recommended'],
  env: {
    [`es${ecmaVersion}`]: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {},
    },
  },
  parserOptions: {
    ecmaVersion,
    project: path.basename(tsconfig.path),
    tsconfigRootDir: path.dirname(tsconfig.path),
  },
  ignorePatterns: ['infrastructure/**'],
  rules: {
    'import/order': 'off',
    'import/prefer-default-export': 'off',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-restricted-syntax': [
      'off',
      {
        selector: 'ForInStatement',
      },
      {
        selector: 'ForOfStatement',
      },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
  },
  overrides: [
    {
      files: ['*.js', '*.jsx'],
      extends: ['prettier'],
    },
    {
      files: ['*.ts', '*.tsx'],
      extends: [
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:import/typescript',
        'prettier',
      ],
      plugins: ['@typescript-eslint'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-shadow': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            varsIgnorePattern: '^_',
            argsIgnorePattern: '^_',
          },
        ],
        'no-shadow': 'off',
        '@typescript-eslint/no-floating-promises': 'error',
      },
    },
    {
      files: ['*.test.ts', '*.spec.ts', '*.test.tsx', '*.spec.tsx'],
      extends: ['plugin:vitest/recommended'],
      env: {
        [`es${ecmaVersion}`]: true,
        node: true,
      },
      globals: {
        vi: true,
        describe: true,
        it: true,
        test: true,
        expect: true,
        beforeEach: true,
        afterEach: true,
        beforeAll: true,
        afterAll: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/unbound-method': 'off',
        'import/no-extraneous-dependencies': [
          'error',
          {
            devDependencies: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.tsx', '**/*.test.tsx'],
          },
        ],
        'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
        'no-console': 'off',
      },
    },
  ],
};
