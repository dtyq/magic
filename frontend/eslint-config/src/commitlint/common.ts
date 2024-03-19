const RuleConfigSeverity = {
	Disabled: 0,
	Warning: 1,
	Error: 2,
}

export const common = {
	rules: {
		"type-enum": [
			RuleConfigSeverity.Error,
			"always",
			[
				"build",
				"chore",
				"ci",
				"docs",
				"feat",
				"fix",
				"perf",
				"refactor",
				"revert",
				"style",
				"test",
				"major",
				"config",
			],
		],
		"body-max-line-length": [RuleConfigSeverity.Disabled],
		"body-leading-blank": [RuleConfigSeverity.Disabled], // body换行
		// "body-leading-blank": [RuleConfigSeverity.Warning, "always"],
		// "body-max-line-length": [RuleConfigSeverity.Error, "always", 100],
		"footer-leading-blank": [RuleConfigSeverity.Disabled, "always"], // footer以空行开头
		// "footer-leading-blank": [RuleConfigSeverity.Warning, "always"],
		"footer-max-line-length": [RuleConfigSeverity.Error, "always", 100],
		"header-max-length": [RuleConfigSeverity.Error, "always", 72], // header最长72
		// "header-max-length": [RuleConfigSeverity.Error, "always", 100],
		"header-trim": [RuleConfigSeverity.Error, "always"],
		"subject-case": [RuleConfigSeverity.Disabled],
		// "subject-case": [
		// 	RuleConfigSeverity.Error,
		// 	"never",
		// 	["sentence-case", "start-case", "pascal-case", "upper-case"],
		// ],
		"subject-empty": [RuleConfigSeverity.Disabled, "never"],
		"subject-full-stop": [RuleConfigSeverity.Disabled, "never", "."], // subject以.为结束标记
		// "subject-full-stop": [RuleConfigSeverity.Error, "never", "."],
		"type-case": [RuleConfigSeverity.Disabled, "always", "lower-case"],
		"type-empty": [RuleConfigSeverity.Error, "never"],
	},
	prompt: {
		questions: {
			type: {
				description: "Select the type of change that you're committing",
				enum: {
					build: {
						description:
							"Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)",
						title: "Builds",
						emoji: "🛠",
					},
					chore: {
						description: "Other changes that don't modify src or test files",
						title: "Chores",
						emoji: "♻️",
					},
					ci: {
						description:
							"Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)",
						title: "Continuous Integrations",
						emoji: "⚙️",
					},
					docs: {
						description: "Documentation only changes",
						title: "Documentation",
						emoji: "📚",
					},
					feat: {
						description: "A new feature",
						title: "Features",
						emoji: "✨",
					},
					fix: {
						description: "A bug fix",
						title: "Bug Fixes",
						emoji: "🐛",
					},
					perf: {
						description: "A code change that improves performance",
						title: "Performance Improvements",
						emoji: "🚀",
					},
					refactor: {
						description: "A code change that neither fixes a bug nor adds a feature",
						title: "Code Refactoring",
						emoji: "📦",
					},
					revert: {
						description: "Reverts a previous commit",
						title: "Reverts",
						emoji: "🗑",
					},
					style: {
						description:
							"Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)",
						title: "Styles",
						emoji: "💎",
					},
					test: {
						description: "Adding missing tests or correcting existing tests",
						title: "Tests",
						emoji: "🚨",
					},
					major: {
						description: "A breaking change",
						title: "Breaking Changes",
						emoji: "💥",
					},
					config: {
						description: "Changes to the configuration files",
						title: "Configuration",
						emoji: "🔧",
					},
				},
			},
			scope: {
				description: "What is the scope of this change (e.g. component or file name)",
			},
			subject: {
				description: "Write a short, imperative tense description of the change",
			},
			body: {
				description: "Provide a longer description of the change",
			},
			isBreaking: {
				description: "Are there any breaking changes?",
			},
			breakingBody: {
				description:
					"A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself",
			},
			breaking: {
				description: "Describe the breaking changes",
			},
			isIssueAffected: {
				description: "Does this change affect any open issues?",
			},
			issuesBody: {
				description:
					"If issues are closed, the commit requires a body. Please enter a longer description of the commit itself",
			},
			issues: {
				description: 'Add issue references (e.g. "fix #123", "re #123".)',
			},
		},
	},
}
