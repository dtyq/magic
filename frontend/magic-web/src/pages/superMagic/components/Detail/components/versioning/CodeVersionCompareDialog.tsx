import { useMemo } from "react"
import { useThemeMode } from "antd-style"
import { useTranslation } from "react-i18next"
import MagicModal from "@/components/base/MagicModal"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { MonacoDiffEditor } from "@/lib/monacoEditor"
import { getMonacoLanguageByFileName } from "@/components/base/CodeEditor/utils"

interface CodeVersionCompareDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	currentContent: string
	serverContent: string
	fileName?: string
	onUseMyVersion: () => void
	onUseServerVersion: () => void
}

function CodeVersionCompareDialog({
	open,
	onOpenChange,
	currentContent,
	serverContent,
	fileName,
	onUseMyVersion,
	onUseServerVersion,
}: CodeVersionCompareDialogProps) {
	const { t } = useTranslation("super")
	const { appearance } = useThemeMode()
	const monacoTheme = appearance === "dark" ? "vs-dark" : "light"
	const language = getMonacoLanguageByFileName(fileName)
	const diffEditorOptions = useMemo(
		() => ({
			automaticLayout: true,
			readOnly: true,
			originalEditable: false,
			renderSideBySide: true,
			enableSplitViewResizing: true,
			renderOverviewRuler: false,
			minimap: {
				enabled: false,
			},
			scrollBeyondLastLine: false,
			wordWrap: "off" as const,
			diffWordWrap: "off" as const,
			lineNumbers: "on" as const,
			folding: true,
			fontSize: 14,
			lineHeight: 22,
			fontFamily: "Consolas, Monaco, 'Courier New', monospace",
			scrollbar: {
				vertical: "auto" as const,
				horizontal: "auto" as const,
				alwaysConsumeMouseWheel: false,
			},
			renderIndicators: true,
			contextmenu: false,
		}),
		[],
	)
	const loadingPlaceholder = (
		<div className="flex h-full w-full items-center justify-center bg-white dark:bg-[#1e1e1e]">
			<Spinner size={20} className="animate-spin text-muted-foreground" />
		</div>
	)

	function handleUseMyVersionAndClose() {
		onUseMyVersion()
		onOpenChange(false)
	}

	function handleUseServerVersionAndClose() {
		onUseServerVersion()
		onOpenChange(false)
	}

	return (
		<MagicModal
			open={open}
			onCancel={() => onOpenChange(false)}
			title={t("ppt.codeVersionCompare.title")}
			width="95vw"
			footer={null}
			closable={true}
			classNames={{
				body: "!p-0",
			}}
		>
			<div className="flex flex-col gap-3" data-testid="html-code-version-compare-dialog">
				<p className="mt-3 px-6 text-sm text-muted-foreground">
					{t("ppt.codeVersionCompare.description")}
				</p>

				<div className="flex items-center justify-between gap-4 px-6 text-sm">
					<div
						className="flex min-w-0 flex-1 items-center justify-center rounded-md border bg-muted/40 px-3 py-2 font-medium"
						data-testid="html-code-version-compare-my-label"
					>
						{t("ppt.versionCompare.myVersion")}
					</div>
					<div
						className="flex min-w-0 flex-1 items-center justify-center rounded-md border bg-muted/40 px-3 py-2 font-medium"
						data-testid="html-code-version-compare-server-label"
					>
						{t("ppt.versionCompare.serverVersion")}
					</div>
				</div>

				<div className="h-[65vh] overflow-hidden px-6">
					<div className="h-full overflow-hidden rounded-md border bg-white dark:bg-card">
						<MonacoDiffEditor
							height="100%"
							original={currentContent}
							modified={serverContent}
							language={language}
							theme={monacoTheme}
							options={diffEditorOptions}
							loading={loadingPlaceholder}
						/>
					</div>
				</div>

				<div className="flex justify-end gap-2 px-6 pb-4 pt-2">
					<button
						type="button"
						className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
						onClick={() => onOpenChange(false)}
						data-testid="html-code-version-compare-cancel-button"
					>
						{t("common.cancel")}
					</button>
					<button
						type="button"
						className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
						onClick={handleUseServerVersionAndClose}
						data-testid="html-code-version-compare-use-server-version-button"
					>
						{t("ppt.versionCompare.serverVersion")}
					</button>
					<button
						type="button"
						className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						onClick={handleUseMyVersionAndClose}
						data-testid="html-code-version-compare-use-my-version-button"
					>
						{t("ppt.versionCompare.myVersion")}
					</button>
				</div>
			</div>
		</MagicModal>
	)
}

export default CodeVersionCompareDialog
