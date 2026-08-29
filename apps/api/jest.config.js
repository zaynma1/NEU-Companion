module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { useESM: true, isolatedModules: true }],
  },
  transformIgnorePatterns: ['node_modules/(?!(?:@nestjs/typeorm|@nestjs)/)'],
};
