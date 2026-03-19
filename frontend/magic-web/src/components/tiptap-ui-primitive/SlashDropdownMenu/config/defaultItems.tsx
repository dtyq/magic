import { Editor, Range } from "@tiptap/react"
import {
	IconH1,
	IconH2,
	IconH3,
	IconList,
	IconListNumbers,
	IconSquareCheck,
	IconBlockquote,
	IconCode,
	IconPhoto,
	IconMinus,
	IconTypography,
	IconTable,
} from "@tabler/icons-react"
import type { SuggestionItem, SlashMenuItemType } from "../types"
import { DEFAULT_GROUPS } from "../types"
import { isExtensionAvailable } from "@/lib/tiptap-utils"

// Type for translation function
type TranslationFunction = (key: string) => string

/**
 * Create default slash menu items based on editor capabilities
 */
export function createDefaultMenuItems(editor: Editor, t?: TranslationFunction): SuggestionItem[] {
	// Editor instance is available for capability checks in individual item configurations
	// Helper function to safely delete range
	const deleteRangeIfExists = (editorInstance: Editor, range?: Range | null) => {
		if (range) {
			return editorInstance.chain().focus().deleteRange(range)
		}
		return editorInstance.chain().focus()
	}

	// Use the editor parameter to avoid unused variable warning
	void editor

	// Helper function to get translated text or fallback to default
	const getText = (key: string, fallback: string) => {
		return t ? t(`editor.slashMenu.items.${key}`) : fallback
	}

	return [
		// Formatting
		{
			id: "text",
			type: "text",
			title: getText("text.title", "Text"),
			subtext: getText("text.subtext", "Just start typing with plain text."),
			aliases: ["p", "paragraph", "plain"],
			icon: <IconTypography size={18} />,
			group: DEFAULT_GROUPS.FORMATTING,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).setParagraph().run()
			},
			enabled: () => true,
		},

		// Headings
		{
			id: "heading_1",
			type: "heading_1",
			title: getText("heading1.title", "Heading 1"),
			subtext: getText("heading1.subtext", "Big section heading."),
			aliases: ["h1", "title", "big"],
			icon: <IconH1 size={18} />,
			group: DEFAULT_GROUPS.FORMATTING,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).setHeading({ level: 1 }).run()
			},
			enabled: (editor) => editor?.can()?.setHeading({ level: 1 }) || false,
		},

		{
			id: "heading_2",
			type: "heading_2",
			title: getText("heading2.title", "Heading 2"),
			subtext: getText("heading2.subtext", "Medium section heading."),
			aliases: ["h2", "subtitle", "medium"],
			icon: <IconH2 size={18} />,
			group: DEFAULT_GROUPS.FORMATTING,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).setHeading({ level: 2 }).run()
			},
			enabled: (editor) => editor?.can()?.setHeading({ level: 2 }) || false,
		},

		{
			id: "heading_3",
			type: "heading_3",
			title: getText("heading3.title", "Heading 3"),
			subtext: getText("heading3.subtext", "Small section heading."),
			aliases: ["h3", "small"],
			icon: <IconH3 size={18} />,
			group: DEFAULT_GROUPS.FORMATTING,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).setHeading({ level: 3 }).run()
			},
			enabled: (editor) => editor?.can()?.setHeading({ level: 3 }) || false,
		},

		// Additional headings for completeness
		{
			id: "heading_4",
			type: "heading_4",
			title: getText("heading4.title", "Heading 4"),
			subtext: getText("heading4.subtext", "Smaller section heading."),
			aliases: ["h4"],
			icon: <IconH3 size={18} />,
			group: DEFAULT_GROUPS.FORMATTING,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).setHeading({ level: 4 }).run()
			},
			enabled: (editor) => editor?.can()?.setHeading({ level: 4 }) || false,
		},

		{
			id: "heading_5",
			type: "heading_5",
			title: getText("heading5.title", "Heading 5"),
			subtext: getText("heading5.subtext", "Tiny section heading."),
			aliases: ["h5"],
			icon: <IconH3 size={18} />,
			group: DEFAULT_GROUPS.FORMATTING,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).setHeading({ level: 5 }).run()
			},
			enabled: (editor) => editor?.can()?.setHeading({ level: 5 }) || false,
		},

		{
			id: "heading_6",
			type: "heading_6",
			title: getText("heading6.title", "Heading 6"),
			subtext: getText("heading6.subtext", "Smallest section heading."),
			aliases: ["h6"],
			icon: <IconH3 size={18} />,
			group: DEFAULT_GROUPS.FORMATTING,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).setHeading({ level: 6 }).run()
			},
			enabled: (editor) => editor?.can()?.setHeading({ level: 6 }) || false,
		},

		// Lists
		{
			id: "bullet_list",
			type: "bullet_list",
			title: getText("bulletList.title", "Bullet List"),
			subtext: getText("bulletList.subtext", "Create a simple bullet list."),
			aliases: ["ul", "unordered", "bullet", "list"],
			icon: <IconList size={18} />,
			group: DEFAULT_GROUPS.LISTS,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).toggleBulletList().run()
			},
			enabled: (editor) => editor?.can()?.toggleBulletList() || false,
		},

		{
			id: "ordered_list",
			type: "ordered_list",
			title: getText("orderedList.title", "Numbered List"),
			subtext: getText("orderedList.subtext", "Create a list with numbering."),
			aliases: ["ol", "ordered", "numbered", "1."],
			icon: <IconListNumbers size={18} />,
			group: DEFAULT_GROUPS.LISTS,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).toggleOrderedList().run()
			},
			enabled: (editor) => editor?.can()?.toggleOrderedList() || false,
		},

		{
			id: "todo_list",
			type: "todo_list",
			title: getText("todoList.title", "To-do List"),
			subtext: getText("todoList.subtext", "Track tasks with a to-do list."),
			aliases: ["todo", "task", "check", "checkbox"],
			icon: <IconSquareCheck size={18} />,
			group: DEFAULT_GROUPS.LISTS,
			onSelect: ({ editor, range }) => {
				// Use TaskList extension if available, otherwise fallback to plain text
				if (editor?.can()?.toggleTaskList()) {
					deleteRangeIfExists(editor, range).toggleTaskList().run()
				}
			},
			enabled: (editor) => {
				// Check if TaskList extension is available and can be toggled
				return editor?.can()?.toggleTaskList() || true
			},
		},

		// Blocks
		{
			id: "quote",
			type: "quote",
			title: getText("quote.title", "Quote"),
			subtext: getText("quote.subtext", "Capture a quote."),
			aliases: ["blockquote", "citation"],
			icon: <IconBlockquote size={18} />,
			group: DEFAULT_GROUPS.BLOCKS,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).toggleBlockquote().run()
			},
			enabled: (editor) => editor?.can()?.toggleBlockquote() || false,
		},

		{
			id: "code_block",
			type: "code_block",
			title: getText("codeBlock.title", "Code Block"),
			subtext: getText("codeBlock.subtext", "Capture a code snippet."),
			aliases: ["code", "codeblock", "pre"],
			icon: <IconCode size={18} />,
			group: DEFAULT_GROUPS.BLOCKS,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).toggleCodeBlock().run()
			},
			enabled: (editor) => editor?.can()?.toggleCodeBlock() || false,
		},

		{
			id: "divider",
			type: "divider",
			title: getText("divider.title", "Divider"),
			subtext: getText("divider.subtext", "Visually divide blocks."),
			aliases: ["hr", "horizontal rule", "break", "separator"],
			icon: <IconMinus size={18} />,
			group: DEFAULT_GROUPS.BLOCKS,
			onSelect: ({ editor, range }) => {
				deleteRangeIfExists(editor, range).setHorizontalRule().run()
			},
			enabled: (editor) => editor?.can()?.setHorizontalRule() || false,
		},

		{
			id: "table",
			type: "table",
			title: getText("table.title", "Table"),
			subtext: getText("table.subtext", "Insert a table with rows and columns."),
			aliases: ["table", "grid", "rows", "columns"],
			icon: <IconTable size={18} />,
			group: DEFAULT_GROUPS.BLOCKS,
			onSelect: ({ editor, range }) => {
				// Insert a basic 3x3 table
				if (editor?.can()?.insertTable?.()) {
					deleteRangeIfExists(editor, range)
						.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
						.run()
				}
			},
			enabled: (editor) => {
				// Check if Table extension is available
				return editor?.can()?.insertTable?.() || true
			},
		},

		// Media (conditional - only if Image extension is available)
		{
			id: "image",
			type: "image",
			title: getText("image.title", "Image"),
			subtext: getText("image.subtext", "Upload or embed with a link."),
			aliases: ["img", "picture", "photo"],
			icon: <IconPhoto size={18} />,
			group: DEFAULT_GROUPS.MEDIA,
			onSelect: ({ editor, range }) => {
				// For now, just prompt for image URL and insert as markdown
				const url = prompt("Enter image URL:")
				if (url) {
					deleteRangeIfExists(editor, range).insertContent(`![Image](${url})`).run()
				}
			},
			enabled: () => false,
		},

		// Storage Image
		{
			id: "storage_image",
			type: "storage_image",
			title: getText("storageImage.title", "Storage Image"),
			subtext: getText("storageImage.subtext", "Upload image to local storage."),
			aliases: ["storage", "local image", "browser storage"],
			icon: <IconPhoto size={18} />,
			group: DEFAULT_GROUPS.MEDIA,
			onSelect: ({ editor, range }) => {
				// Delete the slash command text first
				if (range) {
					editor.chain().focus().deleteRange(range).run()
				}

				// Create file input for storage image upload
				const input = document.createElement("input")
				input.type = "file"
				input.accept = "image/*"
				input.style.display = "none"

				const handleChange = async (e: Event) => {
					const target = e.target as HTMLInputElement
					const file = target.files?.[0]

					// Clean up
					input.removeEventListener("change", handleChange)
					document.body.removeChild(input)

					if (!file) return

					// Use the editor command to insert storage image
					editor.commands.insertStorageImageFromFile?.(file)
				}

				input.addEventListener("change", handleChange)
				document.body.appendChild(input)
				input.click()
			},
			enabled: (editor) => isExtensionAvailable(editor, "storageImage"),
		},

		// Project Image
		{
			id: "project_image",
			type: "project_image",
			title: getText("projectImage.title", "Project Image"),
			subtext: getText("projectImage.subtext", "Upload image to project."),
			aliases: ["project", "project img", "shared image"],
			icon: <IconPhoto size={18} />,
			group: DEFAULT_GROUPS.MEDIA,
			onSelect: ({ editor, range }) => {
				// Delete the slash command text first
				if (range) {
					editor.chain().focus().deleteRange(range).run()
				}

				// Create file input for project image upload
				const input = document.createElement("input")
				input.type = "file"
				input.accept = "image/*"
				input.style.display = "none"

				const handleChange = async (e: Event) => {
					const target = e.target as HTMLInputElement
					const file = target.files?.[0]

					// Clean up
					input.removeEventListener("change", handleChange)
					document.body.removeChild(input)

					if (!file) return

					// Use the editor command to insert project image
					editor.commands.insertProjectImageFromFile?.(file)
				}

				input.addEventListener("change", handleChange)
				document.body.appendChild(input)
				input.click()
			},
			enabled: (editor) => isExtensionAvailable(editor, "image"),
		},
	]
}

/**
 * Default configuration for slash menu
 */
export const DEFAULT_SLASH_MENU_CONFIG = {
	enabledItems: [] as SlashMenuItemType[], // Empty array means show all available items
	showGroups: true,
	maxItems: 30,
	emptyPlaceholder: "No items found",
	itemGroups: {
		text: DEFAULT_GROUPS.FORMATTING,
		heading_1: DEFAULT_GROUPS.FORMATTING,
		heading_2: DEFAULT_GROUPS.FORMATTING,
		heading_3: DEFAULT_GROUPS.FORMATTING,
		heading_4: DEFAULT_GROUPS.FORMATTING,
		heading_5: DEFAULT_GROUPS.FORMATTING,
		heading_6: DEFAULT_GROUPS.FORMATTING,
		bullet_list: DEFAULT_GROUPS.LISTS,
		ordered_list: DEFAULT_GROUPS.LISTS,
		todo_list: DEFAULT_GROUPS.LISTS,
		quote: DEFAULT_GROUPS.BLOCKS,
		code_block: DEFAULT_GROUPS.BLOCKS,
		divider: DEFAULT_GROUPS.BLOCKS,
		table: DEFAULT_GROUPS.BLOCKS,
		inline_math: DEFAULT_GROUPS.MATH,
		block_math: DEFAULT_GROUPS.MATH,
		image: DEFAULT_GROUPS.MEDIA,
		storage_image: DEFAULT_GROUPS.MEDIA,
		project_image: DEFAULT_GROUPS.MEDIA,
	},
}

/**
 * Filter menu items based on enabled types and editor capabilities
 */
export function filterEnabledItems(
	allItems: SuggestionItem[],
	enabledTypes: SlashMenuItemType[] = [],
	editor?: Editor | null,
): SuggestionItem[] {
	if (enabledTypes.length === 0) return allItems

	return allItems.filter(
		(item) =>
			enabledTypes.includes(item.type) &&
			(item.enabled ? (editor ? item.enabled(editor) : true) : true),
	)
}
