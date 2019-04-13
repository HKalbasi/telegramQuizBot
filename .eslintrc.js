module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    "no-restricted-syntax": ["error", "ForInStatement", "LabeledStatement", "WithStatement"],
    "no-await-in-loop" : "off" ,
    "consistent-return" : "off" ,
    "no-console" : "off" ,
  },
};
