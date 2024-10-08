module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/test/**/*.spec.ts'],
    collectCoverageFrom: [
        '<rootDir>/src/**/*.ts',
        '!<rootDir>/src/types/**/*.ts',
    ],
    transformIgnorePatterns: [
        "!node_modules/"
    ],

    globals: {
        'ts-jest': {
            diagnostics: false,
            isolatedModules: true,
        },
    },
};