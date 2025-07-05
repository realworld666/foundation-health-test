module.exports = {
  organizeImportsSkipDestructiveCodeActions: true,
  trailingComma: 'es5',
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  plugins: [require.resolve('prettier-plugin-organize-imports')],
  printWidth: 100,
};
