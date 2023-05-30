module.exports = {
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  plugins: ['filenames', '@typescript-eslint'],
  extends: [
    // 'plugin:@typescript-eslint/recommended',  // We're not using the recommended rules from @typescript-eslint/eslint-plugin  (but leaving this comment as documentation)

    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
  ],
  parserOptions: {
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
    project: './tsconfig.json',
  },
  rules: {
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. '@typescript-eslint/explicit-function-return-type': 'off',
    // 0 is 'off', 1 is 'warning', 2 is 'error'
    camelcase: 'off',
    curly: 2,
    'no-await-in-loop': 1,
    'no-empty': 2,
    //'max-len': [1, { code: 150, ignoreComments: true, ignoreUrls: true }],
    'no-const-assign': 2,
    'no-var': 2,
    //'prefer-const': 2,
    'no-inner-declarations': 2,
    'no-unreachable': 2,
    'class-methods-use-this': 1,
    'no-return-await': 2,
    '@typescript-eslint/camelcase': 1,
    '@typescript-eslint/class-name-casing': 2,
    'prefer-template': 2,
    '@typescript-eslint/interface-name-prefix': [2, { prefixWithI: 'always' }],
    '@typescript-eslint/no-for-in-array': 2,
    //'@typescript-eslint/no-misused-promises': 2,
    '@typescript-eslint/no-this-alias': 2,
    '@typescript-eslint/no-unused-vars': 2,
    '@typescript-eslint/require-await': 2,
    '@typescript-eslint/unbound-method': 1,
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/class-name-casing': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/require-await': 'off',
  },
};
