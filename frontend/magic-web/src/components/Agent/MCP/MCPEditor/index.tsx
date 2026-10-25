import { Button } from "antd"
import { IconX } from "@tabler/icons-react"
import { IconMCP } from "@/enhance/tabler/icons-react"
import MagicEditor from "@/components/base/MagicEditor"
import { useTheme } from "@/models/config/hooks"
import { useMemoizedFn } from "ahooks"
import type { AgentCommonModalChildrenProps } from "../../AgentCommonModal"
import type { editor } from "monaco-editor"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

interface MCPEditor extends AgentCommonModalChildrenProps {
	value?: string
	onChange?: (value: string) => void
}

const defaultSchema = '{\n    "mcpServers": {}\n}'

export default function MCPEditor(props: MCPEditor) {
	const { onClose, value, onChange } = props
	const { t } = useTranslation("agent")
	const { prefersColorScheme } = useTheme()

	const [marker, setMarker] = useState<Array<editor.IMarker>>([])
	const [rawValue, setRawValue] = useState(props?.value || defaultSchema)

	const onEditorChange = useMemoizedFn((rawValue: string | undefined) => {
		setRawValue?.(rawValue || "")
	})

	const onSubmit = useMemoizedFn(() => {
		// Validate imported MCP configuration in addition to Monaco's JSON diagnostics.
		try {
			const mcpSchema = JSON.parse(rawValue)
			if (marker.length > 0 && mcpSchema?.mcpServers) {
				magicToast.error(t("mcp.editor.error"))
				return
			}
			onChange?.(rawValue)
			onClose?.()
		} catch (error: any) {
			magicToast.error(t("mcp.editor.formatError"))
		}
	})

	return (
		<div className="w-full overflow-hidden rounded-[12px]">
			<div className="flex h-[70px] w-full items-center justify-between p-5 text-lg font-semibold not-italic leading-6 text-foreground/80">
				<div className="flex items-center gap-2">
					<div className="size-[30px] overflow-hidden rounded-[6px]">
						<IconMCP size={30} />
					</div>
					{t("mcp.editor.title")}
				</div>
				<div
					className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] transition-all duration-100 ease-linear hover:bg-fill active:bg-fill-secondary dark:hover:bg-white/10 dark:active:bg-white/[0.15]"
					onClick={onClose}
				>
					<IconX size={24} />
				</div>
			</div>
			<div className="flex flex-col gap-5 px-5 pb-5">
				{/* Keep Monaco's gutter, editor, and sticky header on the same theme surface. */}
				<div className="h-[400px] w-full overflow-hidden rounded-[8px] border border-border bg-neutral-50 py-2.5 pl-2.5 dark:bg-neutral-900 [&_.monaco-editor]:[--vscode-editor-background:theme(colors.neutral.50)] [&_.monaco-editor]:[--vscode-editorGutter-background:theme(colors.neutral.50)] [&_.monaco-editor]:[--vscode-editorStickyScroll-background:theme(colors.neutral.50)] dark:[&_.monaco-editor]:[--vscode-editor-background:theme(colors.neutral.900)] dark:[&_.monaco-editor]:[--vscode-editorGutter-background:theme(colors.neutral.900)] dark:[&_.monaco-editor]:[--vscode-editorStickyScroll-background:theme(colors.neutral.900)]">
					<MagicEditor
						// Match Monaco's syntax colors to the surrounding Tailwind theme surface.
						theme={prefersColorScheme === "dark" ? "vs-dark" : "vs"}
						language="json"
						defaultValue={defaultSchema}
						value={value}
						onChange={onEditorChange}
						onValidate={setMarker}
					/>
				</div>
				<div className="flex w-full items-center justify-end">
					<div className="flex items-center gap-2.5">
						<Button
							className="dark:!border-border dark:!bg-fill dark:!text-foreground/80 dark:hover:!bg-fill-secondary"
							onClick={onClose}
						>
							{t("mcp.editor.cancel")}
						</Button>
						<Button
							type="primary"
							className="dark:!bg-primary dark:!text-primary-foreground dark:hover:!bg-primary/90"
							onClick={onSubmit}
						>
							{t("mcp.editor.confirm")}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
