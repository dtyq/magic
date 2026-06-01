import { defineConfig } from 'father';

export default defineConfig({
  targets: {
    chrome: 80,
  },
  esm: {
    input: 'src',
    output: 'es',
    ignores: ['**/__tests__/**', '**/__benchmark__/**'],
    overrides: {
      'src/plugins': {
        output: 'plugins',
      },
      'src/themes': {
        output: 'themes',
      },
    },
  },
  cjs: {
    input: 'src',
    output: 'lib',
    ignores: ['**/__tests__/**', '**/__benchmark__/**'],
  },
  umd: {
    entry: {
      'src/index.ts': {
        name: 'XMarkdown',
        sourcemap: true,
        generateUnminified: true,
        output: {
          path: 'dist/',
          filename: 'x-markdown',
        },
      },
      'src/plugins/Latex/index.ts': {
        name: 'Latex',
        sourcemap: true,
        generateUnminified: true,
        output: {
          path: 'dist/plugins',
          filename: 'latex',
        },
      },
    },
    bundler: 'webpack',
    concatenateModules: true,
    externals: {
      react: {
        root: 'React',
        commonjs: 'react',
        commonjs2: 'react',
      },
      'react-dom': {
        root: 'ReactDOM',
        commonjs: 'react-dom',
        commonjs2: 'react-dom',
      },
    },
    chainWebpack: (memo) => {
      return memo;
    },
  },
});
