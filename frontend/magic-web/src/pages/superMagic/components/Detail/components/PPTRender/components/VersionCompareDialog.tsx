import { useTranslation } from "react-i18next"
import { useRef, useState } from "react"
import { Check } from "lucide-react"
import MagicModal from "@/components/base/MagicModal"
import IsolatedHTMLRenderer, {
	type IsolatedHTMLRendererRef,
} from "../../../contents/HTML/IsolatedHTMLRenderer"

interface VersionCompareDialogProps {
	/** Whether dialog is open */
	open: boolean
	/** Close dialog callback */
	onOpenChange: (open: boolean) => void
	/** User's current editing content */
	currentContent: string
	/** Server's latest content */
	serverContent: string
	/** Callback when user chooses to use their version */
	onUseMyVersion: (editedContent?: string) => void
	/** Callback when user chooses to use server version */
	onUseServerVersion: (editedContent?: string) => void
	/** File path mapping for resources */
	filePathMapping: Map<string, string>
	/** File ID */
	fileId?: string
	/** Open new tab callback */
	openNewTab: (fileId: string, path: string) => void
	/** Selected project */
	selectedProject?: any
	/** Attachment list */
	attachmentList?: any[]
}

function VersionCompareDialog({
	open,
	onOpenChange,
	currentContent,
	serverContent,
	onUseMyVersion,
	onUseServerVersion,
	filePathMapping,
	fileId,
	openNewTab,
	selectedProject,
	attachmentList,
}: VersionCompareDialogProps) {
	const { t } = useTranslation("super")

	// Refs for both editors
	const myVersionRendererRef = useRef<IsolatedHTMLRendererRef>(null)
	const serverVersionRendererRef = useRef<IsolatedHTMLRendererRef>(null)

	// Edit mode states - default to true for immediate editing
	const [isEditingMyVersion] = useState(true)
	const [isEditingServerVersion] = useState(true)

	// Selected version state - 'my' or 'server'
	const [selectedVersion, setSelectedVersion] = useState<"my" | "server">("my")

	// Handle confirm action
	const handleConfirm = async () => {
		if (selectedVersion === "my") {
			// Get edited content if in edit mode
			if (isEditingMyVersion && myVersionRendererRef.current) {
				const editedContent = await myVersionRendererRef.current.getContent()
				if (editedContent) {
					onUseMyVersion(editedContent)
					onOpenChange(false)
					return
				}
			}
			// Use original content
			onUseMyVersion()
		} else {
			// Get edited content if in edit mode
			if (isEditingServerVersion && serverVersionRendererRef.current) {
				const editedContent = await serverVersionRendererRef.current.getContent()
				if (editedContent) {
					onUseServerVersion(editedContent)
					onOpenChange(false)
					return
				}
			}
			// Use original content
			onUseServerVersion()
		}
		onOpenChange(false)
	}

	return (
		<MagicModal
			open={open}
			onCancel={() => onOpenChange(false)}
			title={t("ppt.versionCompare.title")}
			width="95vw"
			footer={null}
			closable={true}
			classNames={{
				body: "!p-0",
			}}
		>
			<div className="flex flex-col gap-3" data-testid="ppt-version-compare-dialog">
				<p className="mt-3 px-6 text-sm text-muted-foreground">
					{t("ppt.serverUpdateAvailableDescription")}
				</p>

				<div className="flex h-[65vh] gap-4 overflow-hidden px-6">
					{/* Left side - User's version */}
					<div
						className={`flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-lg border-2 p-2 transition-all ${selectedVersion === "my"
								? "border-primary bg-primary/5"
								: "border-transparent hover:border-border"
							}`}
						onClick={() => setSelectedVersion("my")}
					>
						<div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5">
							<div className="flex items-center gap-2">
								<div
									className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${selectedVersion === "my"
											? "border-primary bg-primary"
											: "border-muted-foreground/30"
										}`}
								>
									{selectedVersion === "my" && (
										<Check className="h-3 w-3 text-primary-foreground" />
									)}
								</div>
								<span className="text-sm font-medium">
									{t("ppt.versionCompare.myVersion")}
								</span>
							</div>
						</div>
						<div className="flex-1 overflow-hidden rounded-md border bg-white dark:bg-card">
							<IsolatedHTMLRenderer
								ref={myVersionRendererRef}
								content={currentContent}
								sandboxType="iframe"
								isPptRender
								isEditMode={isEditingMyVersion}
								filePathMapping={filePathMapping}
								openNewTab={openNewTab}
								fileId={fileId ? `${fileId}-my` : undefined}
								selectedProject={selectedProject}
								attachmentList={attachmentList}
								isVisible={true}
								toolbarClassName="absolute left-1/2 top-2 z-[10] -translate-x-1/2 w-[98%] rounded-lg border border-border bg-white dark:bg-card"
							/>
						</div>
					</div>

					{/* Right side - Server version */}
					<div
						className={`flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-lg border-2 p-2 transition-all ${selectedVersion === "server"
								? "border-primary bg-primary/5"
								: "border-transparent hover:border-border"
							}`}
						onClick={() => setSelectedVersion("server")}
					>
						<div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5">
							<div className="flex items-center gap-2">
								<div
									className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${selectedVersion === "server"
											? "border-primary bg-primary"
											: "border-muted-foreground/30"
										}`}
								>
									{selectedVersion === "server" && (
										<Check className="h-3 w-3 text-primary-foreground" />
									)}
								</div>
								<span className="text-sm font-medium">
									{t("ppt.versionCompare.serverVersion")}
								</span>
							</div>
						</div>
						<div className="flex-1 overflow-hidden rounded-md border bg-white dark:bg-card">
							<IsolatedHTMLRenderer
								ref={serverVersionRendererRef}
								content={serverContent}
								sandboxType="iframe"
								isPptRender
								isEditMode={isEditingServerVersion}
								filePathMapping={filePathMapping}
								openNewTab={openNewTab}
								fileId={fileId ? `${fileId}-server` : undefined}
								selectedProject={selectedProject}
								attachmentList={attachmentList}
								isVisible={true}
								toolbarClassName="absolute left-1/2 top-2 z-[10] -translate-x-1/2 w-[98%] rounded-lg border border-border bg-white dark:bg-card"
							/>
						</div>
					</div>
				</div>

				<div className="flex justify-end gap-2 px-6 pb-4 pt-2">
					<button
						data-testid="ppt-version-compare-dialog-cancel"
						className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
						onClick={() => onOpenChange(false)}
					>
						{t("common.cancel")}
					</button>
					<button
						data-testid="ppt-version-compare-dialog-confirm"
						className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						onClick={handleConfirm}
					>
						{t("common.confirm")}
					</button>
				</div>
			</div>
		</MagicModal>
	)
}

export default VersionCompareDialog
