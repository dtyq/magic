import type { I18nTexts } from "../types"

export const en: I18nTexts = {
	// Select path modal
	selectPathItemDescription: {
		rootDirectory: "Root",
	},

	// Search related
	searchPlaceholder: "Search",
	projectFilesSearchPlaceholder: "Search project files",
	searchResults: "Search Results",
	searchHint: "Searching",
	clearSearch: "Clear search",
	searchPrefix: "Search:",

	// Status messages
	loading: "Loading...",
	error: "Failed to load data",
	retry: "Retry",
	empty: "No data available",

	// Hints
	mcpHint: "@extension only take effect once",
	skillHint: "@skill only takes effect once",
	skillSources: {
		system: "System Skill",
		agent: "Crew Skill",
		mine: "My Skill",
	},

	// Panel titles
	panelTitles: {
		default: "",
		search: "Search project files",
		folder: "Folder",
		mcp: "MCP Extensions",
		agent: "Agents",
		skills: "Skills",
	},

	// Default items
	defaultItems: {
		personalDrive: "Personal Drive",
		enterpriseDrive: "Enterprise Drive",
		projectFiles: "Current Project Files",
		mcpExtensions: "Plugins",
		agents: "Agents",
		skills: "Skills",
		tools: "Tools",
		uploadFiles: "Upload Files",
		projectFiles2: "Project Files",
	},

	// Mobile specific
	selectItem: "Select",

	// Error messages
	errorMessages: {
		loadFailed: "Failed to load, please try again",
		searchFailed: "Search failed, please check your network connection",
		networkError: "Network connection error",
		unknownError: "Unknown error",
	},

	// Keyboard shortcuts
	keyboardHints: {
		navigate: "Navigate",
		confirm: "Enter Confirm",
		goBack: "Go back",
		goForward: "Go forward",
		exitSearch: "Exit",
	},

	// Accessibility labels
	ariaLabels: {
		panel: "Mention panel",
		menuItem: "Menu item",
		searchInput: "Search input",
		retryButton: "Retry button",
		goBackButton: "Go back",
		closeButton: "Close",
	},

	// History and tabs related
	historyActions: {
		viewAllOpenFiles: "View all open files",
		viewAllMentionedFiles: "View all mentioned files",
		recentMentionedFiles: "Recently mentioned files",
		currentOpenFiles: "Currently open files",
		smartRecommendations: "Smart Recommendations",
	},
}
