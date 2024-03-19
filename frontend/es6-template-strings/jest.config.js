/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
	verbose: true,
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
	collectCoverage: true,
	collectCoverageFrom: ["./src/**/*.ts"],
	coverageDirectory: "./.coverage",
	setupFiles: ["./tests/setup.ts"],
	transform: {
		"^.+\\.(ts|tsx)$": [
			"ts-jest",
			{
				useESM: false,
				isolatedModules: true,
				tsconfig: "./tsconfig.test.json",
			},
		],
	},
	moduleNameMapper: {
		"lodash-es": "<rootDir>/tests/mocks/lodash-es.ts",
	},
	transformIgnorePatterns: ["node_modules/(?!(lodash-es)/)"],
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
}
