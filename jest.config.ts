/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest'

const config: Config = {
  clearMocks: true,
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest/polyfills.ts'],
  testPathIgnorePatterns: ['\\\\node_modules\\\\'],
  coveragePathIgnorePatterns: ['\\\\node_modules\\\\'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  transform: {
    '^.+\\.(t|j)sx?$': 'babel-jest',
  },
  moduleDirectories: ['node_modules'],
  modulePaths: ['<rootDir>src'],
  testMatch: ['<rootDir>src/**/*(*.)@(spec|test).[tj]s?(x)'],
  rootDir: './',
  moduleNameMapper: {
    '.*\\.(css|less|styl|scss|sass)$': 'identity-obj-proxy',
    '\\.svg': '<rootDir>jest/mockSvg.tsx',
    '^~/(.*)$': '<rootDir>/src/$1',
    '\\.(png|jpg|jpeg|gif|ico)$': '<rootDir>/jest/mockSvg.tsx',
  },
  // d3 и его зависимости поставляются только как ESM — нужна трансформация через Babel
  transformIgnorePatterns: ['node_modules/(?!(d3.*|internmap|robust-predicates|delaunator)/)'],
}

export default config
