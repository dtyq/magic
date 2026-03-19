// Language types for internationalization
export type Language = "en" | "zh-CN"

// Extended locale formats that users might provide
export type LocaleInput =
	| Language
	| "zh"
	| "zh_CN"
	| "zh-CN"
	| "zh-cn"
	| "zh_cn"
	| "en_US"
	| "en-US"
	| "en-us"
	| "en_us"
	| string

// Internationalization text keys
export interface I18nTexts {
	// Select path modal
	selectPathItemDescription: {
		rootDirectory: string
	}

	// Search related
	searchPlaceholder: string
	projectFilesSearchPlaceholder: string
	searchResults: string
	searchHint: string
	clearSearch: string
	searchPrefix: string

	// Status messages
	loading: string
	error: string
	retry: string
	empty: string

	// Hints
	mcpHint: string
	skillHint: string

	// Panel titles
	panelTitles: {
		default: string
		search: string
		folder: string
		mcp: string
		agent: string
		skills: string
	}

	// Mobile specific
	selectItem: string

	// Default items
	defaultItems: {
		uploadFiles: any
		personalDrive: string
		enterpriseDrive: string
		projectFiles: string
		mcpExtensions: string
		agents: string
		skills: string
		tools: string
		projectFiles2: string
	}

	// Error messages
	errorMessages: {
		loadFailed: string
		searchFailed: string
		networkError: string
		unknownError: string
	}

	// Keyboard shortcuts
	keyboardHints: {
		navigate: string
		confirm: string
		goBack: string
		goForward: string
		exitSearch: string
	}

	// Accessibility labels
	ariaLabels: {
		panel: string
		menuItem: string
		searchInput: string
		retryButton: string
		goBackButton: string
		closeButton: string
	}

	// History and tabs related
	historyActions: {
		viewAllOpenFiles: string
		viewAllMentionedFiles: string
		recentMentionedFiles: string
		currentOpenFiles: string
		smartRecommendations: string
	}
}

// Hook return type
export interface UseI18nReturn {
	t: I18nTexts
	language: Language
	setLanguage: (lang: LocaleInput) => void
}
