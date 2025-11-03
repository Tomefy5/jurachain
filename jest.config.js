module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/tests/**',
        '!src/**/*.test.js'
    ],
    testMatch: [
        '**/src/tests/**/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
    transformIgnorePatterns: [
        'node_modules/(?!(uuid)/)'
    ],
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid')
    }
};