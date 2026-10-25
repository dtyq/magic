import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Check, X } from "lucide-react"
import type { Editor } from "@/infrastructure/editors/tiptap/core"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useDialogWindowFrame } from "@/pages/superMagic/hooks/useDialogWindowFrame"
import {
	DialogRestoreSizeButton,
	DialogWindowDecorations,
} from "@/pages/superMagic/components/DialogWindow"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
} from "@/components/shadcn-ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/shadcn-ui/sheet"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Switch } from "@/components/shadcn-ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { cn } from "@/utils/cn"
import type { FileUploadStore } from "../../stores/FileUploadStore"
import type { WechatChatImportController } from "../../hooks/useWechatChatImport"
import { findWechatChat } from "../../extensions/wechat-chat-history/commands"
import { parseWechatChat } from "../../extensions/wechat-chat-history/parser"
import { WechatChatContext } from "./context"
import { useChatScroll } from "./useChatScroll"
import ChatPreview, { ChatPreviewTitle } from "./ChatPreview"
import SlashMenu from "./SlashMenu"
import PasteGuide from "./PasteGuide"
import magicToast from "@/components/base/MagicToaster/utils"

interface EditorHostProps {
	editor: Editor | null
	controller: WechatChatImportController
	fileUploadStore: FileUploadStore
	scrollRef: React.RefObject<HTMLDivElement>
	children: ReactNode
}

export default observer(function EditorHost({
	editor,
	controller,
	fileUploadStore,
	scrollRef,
	children,
}: EditorHostProps) {
	const { t } = useTranslation("super")
	const mobile = useIsMobile()
	const home = useRef<HTMLDivElement>(null)
	const slot = useRef<HTMLDivElement | null>(null)
	const [rightViewport, setRightViewport] = useState<HTMLDivElement | null>(null)
	const right = useMemo(() => ({ current: rightViewport }), [rightViewport])
	const [tab, setTab] = useState("preview")
	const [host] = useState(() => document.createElement("div"))
	host.className = "flex h-full min-h-0 flex-col"
	const open = controller.activeId !== null
	const windowFrame = useDialogWindowFrame(open && !mobile, {
		storageKeyPrefix: "super_magic/wechat_chat_history_dialog",
		recommendedSize: { width: 1400, height: 960 },
		viewportRatio: { width: 0.94, height: 0.88 },
		minSize: { width: 840, height: 520 },
	})
	const location =
		editor && controller.activeId ? findWechatChat(editor, controller.activeId) : null
	const sourceNode = location?.node
	const position = location?.position
	const snapshot = useMemo(() => {
		return parseWechatChat(
			sourceNode?.toJSON().content ?? [],
			position !== undefined ? position + 1 : 0,
		)
	}, [sourceNode, position])
	const currentTab = snapshot.messages.length ? tab : "edit"
	const { synced, toggle } = useChatScroll(
		editor,
		scrollRef,
		right,
		snapshot.messages,
		controller.activeId,
		controller.scrollRequest,
	)
	// Portal 的目标节点始终不变，只移动同一个 DOM 容器，避免销毁 EditorContent／NodeView／撤销与附件队列。
	useLayoutEffect(() => {
		const homeSlot = home.current
		;(open ? slot.current : homeSlot)?.appendChild(host)
		if (open) {
			setTab("preview")
			if (mobile) editor?.commands.blur()
			else editor?.commands.focus()
		}
		return () => {
			if (open) homeSlot?.appendChild(host)
		}
	}, [host, open, mobile, editor])
	const close = () => {
		home.current?.appendChild(host)
		controller.close()
	}
	const title = (
		<>
			<span>{t("wechatChat.previewTitle")}</span>
			<span className="mt-1 block text-xs font-normal text-muted-foreground">
				{t("wechatChat.editorHint")}
			</span>
		</>
	)
	const body = (
		<>
			<div
				data-dialog-drag-handle={!mobile || undefined}
				className={cn(
					"flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4",
					!mobile && "cursor-grab touch-none select-none active:cursor-grabbing",
				)}
			>
				<div className="min-w-0">
					{mobile ? (
						<SheetTitle className="text-sm">{title}</SheetTitle>
					) : (
						<DialogTitle className="text-sm">{title}</DialogTitle>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-5">
					{!mobile && <DialogRestoreSizeButton frame={windowFrame} />}
					<label className="flex items-center gap-2 text-xs text-muted-foreground">
						<span>{t("wechatChat.syncScroll")}</span>
						<Switch
							checked={synced}
							onCheckedChange={toggle}
							aria-label={t("wechatChat.syncScroll")}
						/>
					</label>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8"
						aria-label={t("wechatChat.close")}
						onClick={close}
					>
						<X className="size-4" />
					</Button>
				</div>
			</div>
			{mobile && (
				<Tabs value={currentTab} onValueChange={setTab} className="shrink-0 px-4 pt-3">
					<TabsList className="w-full">
						<TabsTrigger value="edit" className="flex-1">
							{t("wechatChat.edit")}
						</TabsTrigger>
						<TabsTrigger value="preview" className="flex-1">
							{t("wechatChat.preview")}
						</TabsTrigger>
					</TabsList>
				</Tabs>
			)}
			{/* 只裁剪两侧内容，保留窗口外侧的尺寸调整热区和引导。 */}
			<div
				className={cn(
					"grid min-h-0 flex-1 overflow-hidden",
					!mobile && "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
				)}
			>
				<div
					ref={(element) => {
						slot.current = element
						if (element && open && host.parentElement !== element)
							element.appendChild(host)
					}}
					className={cn(
						"flex min-h-0 min-w-0 flex-col p-4",
						mobile && currentTab !== "edit" && "hidden",
					)}
				/>
				<div
					className={cn(
						"flex min-h-0 min-w-0 flex-col bg-muted/30",
						!mobile && "border-l",
						mobile && currentTab !== "preview" && "hidden",
					)}
				>
					<div className="shrink-0 border-b px-5 py-4">
						<ChatPreviewTitle participants={snapshot.participants} />
					</div>
					<ScrollArea
						className="min-h-0 flex-1"
						viewportRef={setRightViewport}
						viewportClassName="h-full"
					>
						{snapshot.messages.length ? (
							<ChatPreview
								snapshot={snapshot}
								files={fileUploadStore.files}
								onRetry={(id) => {
									void fileUploadStore
										.handleRetry(id)
										.catch(() => magicToast.error(t("wechatChat.uploadFailed")))
								}}
							/>
						) : (
							<PasteGuide />
						)}
					</ScrollArea>
					<p className="shrink-0 border-t px-5 py-2 text-xs text-muted-foreground">
						{t("wechatChat.provenance")}
					</p>
				</div>
			</div>
			<div className="flex shrink-0 items-center justify-between gap-4 border-t px-5 py-4">
				<p className="text-xs leading-5 text-muted-foreground">
					{t("wechatChat.confirmHint")}
				</p>
				<Button
					type="button"
					className="shrink-0 gap-2"
					disabled={!snapshot.messages.length}
					onClick={close}
				>
					<Check className="size-4" />
					{t("wechatChat.confirm")}
				</Button>
			</div>
		</>
	)
	return (
		<WechatChatContext.Provider value={controller.available ? controller : null}>
			{/* 原输入区的直接父级可能是普通块布局；承接其高度，避免 flex-1 失效后在编辑器下方留下空白。 */}
			<div ref={home} className="h-full min-h-0 flex-1" />
			{createPortal(children, host)}
			<SlashMenu menu={controller.menu} onDismiss={controller.dismissMenu} />
			{mobile ? (
				<Sheet
					open={open}
					onOpenChange={(value) => {
						if (!value) close()
					}}
				>
					<SheetContent
						side="bottom"
						showClose={false}
						className="flex h-[92dvh] flex-col gap-0 p-0"
						onInteractOutside={(event) => event.preventDefault()}
						onOpenAutoFocus={(event) => event.preventDefault()}
						onCloseAutoFocus={(event) => event.preventDefault()}
					>
						<SheetDescription className="sr-only">
							{t("wechatChat.confirmHint")}
						</SheetDescription>
						{body}
					</SheetContent>
				</Sheet>
			) : (
				<Dialog
					open={open}
					onOpenChange={(value) => {
						if (!value) close()
					}}
				>
					<DialogContent
						showCloseButton={false}
						windowOptions={windowFrame.windowOptions}
						className="flex flex-col gap-0 p-0"
						onInteractOutside={(event) => event.preventDefault()}
						onOpenAutoFocus={(event) => event.preventDefault()}
						onCloseAutoFocus={() => {
							editor?.commands.focus()
						}}
					>
						<DialogDescription className="sr-only">
							{t("wechatChat.confirmHint")}
						</DialogDescription>
						{body}
						<DialogWindowDecorations frame={windowFrame} />
					</DialogContent>
				</Dialog>
			)}
		</WechatChatContext.Provider>
	)
})
