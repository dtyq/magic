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
	unnamedProject: "Unnamed Project",

	// Hints
	mcpHint: "@connector only takes effect once",
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
		mcp: "Connectors",
		agent: "Agents",
		skills: "Skills",
	},

	// Default items
	defaultItems: {
		personalDrive: "Personal Drive",
		enterpriseDrive: "Enterprise Drive",
		projectFiles: "Current Project Files",
		otherProjectFiles: "Other Projects/Files",
		mcpExtensions: "Connectors",
		digitalEmployees: "Digital Employees",
		flows: "Flows",
		agents: "Agents",
		microApps: "Micro apps",
		skills: "Skills",
		tools: "Tools",
		canvasElements: "Canvas Elements",
		uploadFiles: "Upload Files",
		projectFiles2: "Project Files",
	},

	// Mobile specific
	selectItem: "Select",
	multiSelectActions: {
		enter: "Multi-select",
		complete: "Done",
	},
	mobileSelectedItemsLabel: "Selected",
	mobileSelectedItemsTitle: "Selected",
	selectionSummary: {
		selected: "Selected",
		image: "Images",
		video: "Videos",
		audio: "Audio",
	},

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

	navigationActions: {
		enter: "Enter",
	},

	// Accessibility labels
	ariaLabels: {
		panel: "Mention panel",
		menuItem: "Menu item",
		searchInput: "Search input",
		retryButton: "Retry button",
		goBackButton: "Go back",
		previewImage: "Preview image",
		viewMode: "View mode",
		listView: "List view",
		galleryView: "Gallery view",
		closeButton: "Close",
		confirmButton: "Confirm",
		removeSelectedItem: "Remove from selection",
		clearAllSelected: "Clear all selected",
		viewSelectedItems: "View selected items",
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
