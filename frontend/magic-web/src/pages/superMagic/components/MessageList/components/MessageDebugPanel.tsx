import { Copy, FileJson, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import CodeEditor from "@/components/base/CodeEditor"
import MagicTooltip from "@/components/base/MagicTooltip"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import {
	DialogRestoreSizeButton,
	DialogWindowDecorations,
} from "@/pages/superMagic/components/DialogWindow"
import {
	useDialogWindowFrame,
	type DialogWindowFrameConfig,
} from "@/pages/superMagic/hooks/useDialogWindowFrame"
import { clipboard } from "@/utils/clipboard-helpers"
import type { MessageDebugSnapshot } from "../hooks/useMessageDebugPanel"

interface MessageDebugPanelProps {
	snapshot: MessageDebugSnapshot
	onClose: () => void
}

const WINDOW_CONFIG: DialogWindowFrameConfig = {
	storageKeyPrefix: "super_magic/message_debug_dialog",
	recommendedSize: { width: 720, height: 900 },
	minSize: { width: 560, height: 360 },
}

export default function MessageDebugPanel({ snapshot, onClose }: MessageDebugPanelProps) {
	const { t } = useTranslation("super")
	const windowFrame = useDialogWindowFrame(true, WINDOW_CONFIG)
	async function copyText(value: string) {
		try {
			await clipboard.writeText(value)
			magicToast.success(t("common.copySuccess"))
		} catch {
			magicToast.error(t("common.copyFailed"))
		}
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent
				showCloseButton={false}
				windowOptions={windowFrame.windowOptions}
				className="flex flex-col gap-0 overflow-visible rounded-xl p-0"
				aria-describedby={undefined}
				// 连点后的额外点击和遮罩点击只保留窗口；关闭由 Esc 和叉号负责。
				onInteractOutside={(event) => event.preventDefault()}
				onClick={(event) => event.stopPropagation()}
			>
				<DialogHeader
					data-dialog-drag-handle
					className="shrink-0 cursor-grab touch-none select-none flex-row items-center justify-between gap-3 border-b px-5 py-2.5 text-left active:cursor-grabbing sm:px-6"
				>
					<DialogTitle className="text-base font-semibold leading-6">
						{t("debug.message.title")}
					</DialogTitle>
					<div className="flex shrink-0 items-center gap-2">
						<DialogRestoreSizeButton frame={windowFrame} />
						<MagicTooltip title={t("debug.message.close")}>
							<DialogClose asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									className="text-muted-foreground"
									aria-label={t("debug.message.close")}
								>
									<X size={16} />
								</Button>
							</DialogClose>
						</MagicTooltip>
					</div>
				</DialogHeader>
				{/* 从窗口逐层传递剩余高度；缩放只改变阅读区，不移动标题和复制操作。 */}
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-xl">
					<div className="shrink-0 space-y-2 bg-muted/20 px-5 py-5 sm:px-6">
						<span className="text-xs font-medium text-muted-foreground">
							{t("debug.message.sandboxId")}
						</span>
						{/* 复制紧跟完整 ID；长 ID 可以换行，不把操作推到弹窗另一侧。 */}
						<div className="flex items-center gap-1.5">
							{snapshot.sandboxId ? (
								<code className="min-w-0 select-text break-all font-mono text-lg font-medium leading-7 text-foreground">
									{snapshot.sandboxId}
								</code>
							) : (
								<p className="text-sm text-muted-foreground">
									{t("debug.message.sandboxMissing")}
								</p>
							)}
							<MagicTooltip title={t("debug.message.copySandboxId")}>
								<Button
									variant="ghost"
									size="icon-sm"
									className="size-7 text-muted-foreground hover:text-foreground"
									disabled={!snapshot.sandboxId}
									aria-label={t("debug.message.copySandboxId")}
									onClick={() =>
										snapshot.sandboxId && copyText(snapshot.sandboxId)
									}
								>
									<Copy size={16} />
								</Button>
							</MagicTooltip>
						</div>
					</div>
					<section
						className="flex min-h-0 flex-1 flex-col border-t"
						aria-label={t("debug.message.fullJson")}
					>
						{/* 核心复制操作常驻工具栏，不依赖 hover，也不随代码内容滚走。 */}
						<div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-2.5 sm:px-6">
							<div className="flex items-center gap-2">
								<FileJson size={16} className="text-muted-foreground" aria-hidden />
								<h3 className="text-sm font-medium">
									{t("debug.message.fullJson")}
								</h3>
							</div>
							<MagicTooltip title={t("debug.message.copyJson")}>
								<Button
									variant="ghost"
									size="icon-sm"
									className="size-7 text-muted-foreground hover:text-foreground"
									aria-label={t("debug.message.copyJson")}
									onClick={() => copyText(snapshot.json)}
								>
									<Copy size={16} />
								</Button>
							</MagicTooltip>
						</div>
						{/* 复用项目编辑器的换行、折叠与专用滚动；只读模式不改写消息快照。 */}
						<div className="min-h-0 flex-1">
							<CodeEditor
								content={snapshot.json}
								fileName="message.json"
								isEditMode={false}
								editorOptions={{
									fontSize: 13,
									lineHeight: 21,
									padding: { top: 12, bottom: 12 },
									renderLineHighlight: "none",
									unicodeHighlight: {
										ambiguousCharacters: false,
										invisibleCharacters: false,
									},
								}}
							/>
						</div>
					</section>
				</div>
				<DialogWindowDecorations frame={windowFrame} />
			</DialogContent>
		</Dialog>
	)
}
