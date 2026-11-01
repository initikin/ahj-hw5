import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'tmp/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, process: 'readonly' } },
  },
  {
    files: ['**/*.cjs', 'backend/**/*.js'],
    languageOptions: { globals: globals.node },
  },
];
