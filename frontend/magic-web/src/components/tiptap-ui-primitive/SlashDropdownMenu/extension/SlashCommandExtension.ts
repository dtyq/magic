import { Extension } from "@tiptap/core"
import { ReactRenderer } from "@tiptap/react"
import Suggestion from "@tiptap/suggestion"
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion"

import type { SuggestionItem, SlashMenuConfig } from "../types"
import SlashDropdownRenderer from "../components/SlashDropdownRenderer"

export interface SlashCommandOptions {
	/** Configuration for slash menu behavior */
	config?: SlashMenuConfig
	/** Character that triggers the slash command */
	char?: string
	/** Whether to allow spaces in command text */
	allowSpaces?: boolean
	/** Custom container element for mounting */
	getContainer?: () => HTMLElement | null
	/** Custom suggestion options */
	suggestionOptions?: Partial<SuggestionOptions<SuggestionItem>>
}

/**
 * Tiptap extension for slash command functionality
 */
export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
	name: "slashCommand",

	addOptions() {
		return {
			config: {},
			char: "/",
			allowSpaces: false,
			getContainer: undefined,
			suggestionOptions: {},
		}
	},

	addProseMirrorPlugins() {
		// Store reference to avoid linting error about 'this' aliasing
		const storageRef = this.storage
		const { config, char, allowSpaces, getContainer, suggestionOptions } = this.options

		return [
			Suggestion({
				editor: this.editor,
				char: char || "/",
				allowSpaces: allowSpaces || false,
				startOfLine: false,
				items: () => [],
				render: () => {
					let renderer: ReactRenderer | null = null
					let currentProps: SuggestionProps<SuggestionItem> | null = null

					const handleSelect = (item: SuggestionItem) => {
						if (!currentProps) return

						const { editor, range } = currentProps

						try {
							item.onSelect({ editor, range })
						} catch (error) {
							console.error("[SlashCommand] Error executing item action:", error)
						}
					}

					const handleExit = () => {
						if (renderer) {
							renderer.destroy()
							renderer = null
						}
						storageRef.activeRenderer = null
						currentProps?.editor?.commands.focus()
					}

					return {
						onStart: (props: SuggestionProps<SuggestionItem>) => {
							currentProps = props

							renderer = new ReactRenderer(SlashDropdownRenderer, {
								props: {
									editor: props.editor,
									query: props.query,
									range: props.range,
									decorationNode: props.decorationNode,
									config: config || {},
									onSelect: handleSelect,
									onExit: handleExit,
								},
								editor: props.editor,
							})

							storageRef.activeRenderer = renderer

							if (getContainer) {
								const container = getContainer()
								if (container && renderer.element) {
									container.appendChild(renderer.element)
								}
							}
						},

						onUpdate: (props: SuggestionProps<SuggestionItem>) => {
							currentProps = props

							if (renderer) {
								renderer.updateProps({
									editor: props.editor,
									query: props.query,
									range: props.range,
									decorationNode: props.decorationNode,
									config: config || {},
									onSelect: handleSelect,
									onExit: handleExit,
								})
							}
						},

						onKeyDown: (props: SuggestionKeyDownProps) => {
							if (!renderer?.ref) return false
							const rendererRef = renderer.ref as {
								onKeyDown?: (props: SuggestionKeyDownProps) => boolean
							}
							return rendererRef.onKeyDown?.(props) || false
						},

						onExit: () => {
							handleExit()
						},
					}
				},
				...suggestionOptions,
			}),
		]
	},

	addStorage() {
		return {
			activeRenderer: null as ReactRenderer | null,
		}
	},

	onCreate() {
		console.log("[SlashCommand] Extension created with options:", this.options)
	},

	onDestroy() {
		// Clean up any active renderers
		if (this.storage.activeRenderer) {
			this.storage.activeRenderer.destroy()
			this.storage.activeRenderer = null
		}
	},

	addCommands() {
		return {
			triggerSlashCommand:
				(position?: number) =>
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				({ commands, chain }: { commands: any; chain: any }) => {
					if (position !== undefined) {
						return chain
							.focus()
							.setTextSelection(position)
							.insertContent(this.options.char || "/")
							.run()
					}
					return commands.insertContent(this.options.char || "/")
				},

			closeSlashCommand: () => () => {
				if (this.storage.activeRenderer) {
					this.storage.activeRenderer.destroy()
					this.storage.activeRenderer = null
				}
				return true
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any // Type assertion for complex Tiptap command types
	},

	addKeyboardShortcuts() {
		return {
			"Mod-/": () => {
				const commands = this.editor.commands as { triggerSlashCommand?: () => boolean }
				return commands.triggerSlashCommand?.() || false
			},
		}
	},
})

export default SlashCommandExtension
