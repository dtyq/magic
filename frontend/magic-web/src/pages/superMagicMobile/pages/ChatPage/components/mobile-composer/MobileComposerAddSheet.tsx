import { useEffect, useRef, useState } from "react"
import {
	AtSign,
	Camera,
	ChevronRight,
	FileUp,
	Globe,
	ImageIcon,
	type LucideIcon,
	Plug,
	Plus,
	Puzzle,
	X,
} from "lucide-react"
import { useCreation, useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import UploadAction from "@/components/base/UploadAction"
import MCPButton from "@/components/Agent/MCP/MCPButton"
import { getMCPAccess } from "@/components/Agent/MCP/store/mcp-access"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Switch } from "@/components/shadcn-ui/switch"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { MentionSelectContext } from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { cn } from "@/lib/utils"
import At from "@/pages/superMagic/components/MessageEditor/components/At"
import { sceneStateStore } from "@/pages/superMagic/components/MainInputContainer/stores"
import { internetSearchManager } from "@/pages/superMagic/components/MessageEditor/services/InternetSearchManager"
import type { MessageEditorModules } from "@/pages/superMagic/components/MessageEditor/types"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"

const mediaActionCardClassName =
	"flex flex-1 flex-col items-center justify-center gap-2 rounded-[14px] border border-border/60 bg-card/95 px-2 py-5 transition-colors active:scale-95"

function ActionCountBadge({ count }: { count?: number }) {
	if (!count || count <= 0) return null

	return (
		<span
			className={cn(
				"flex h-6 shrink-0 items-center justify-center rounded-full bg-foreground px-2 text-sm font-semibold leading-none text-background",
				count < 10 && "w-6 px-0",
			)}
			data-testid="mobile-composer-add-sheet-action-count"
		>
			{count}
		</span>
	)
}

function AddActionPill({ label }: { label: string }) {
	return (
		<div
			className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3"
			style={{ boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)" }}
		>
			<Plus className="h-4 w-4 text-foreground" />
			<span className="text-sm font-medium leading-5 text-foreground">{label}</span>
		</div>
	)
}

function ActionLabel({ label, count }: { label: string; count?: number }) {
	if (count && count > 0) {
		return (
			<div className="flex min-w-0 items-center gap-2">
				<span className="text-base leading-none text-foreground">{label}</span>
				<ActionCountBadge count={count} />
			</div>
		)
	}

	return <span className="text-base leading-none text-foreground">{label}</span>
}

interface MediaActionCardProps {
	label: string
	ariaLabel: string
	dataTestId: string
	icon: LucideIcon
	onClick: () => void
}

function MediaActionCard({
	label,
	ariaLabel,
	dataTestId,
	icon: Icon,
	onClick,
}: MediaActionCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={mediaActionCardClassName}
			aria-label={ariaLabel}
			data-testid={dataTestId}
		>
			<Icon className="h-5 w-5 text-foreground" />
			<span className="text-base leading-none text-foreground">{label}</span>
		</button>
	)
}

interface MediaUploadActionProps {
	label: string
	dataTestId: string
	icon: LucideIcon
	onFileChange: (files: FileList) => void
	accept?: string
	capture?: "user" | "environment"
	multiple?: boolean
}

function MediaUploadAction({
	label,
	dataTestId,
	icon,
	onFileChange,
	accept,
	capture,
	multiple = false,
}: MediaUploadActionProps) {
	return (
		<UploadAction
			accept={accept}
			capture={capture}
			multiple={multiple}
			onFileChange={onFileChange}
			handler={(trigger) => (
				<MediaActionCard
					label={label}
					ariaLabel={label}
					dataTestId={dataTestId}
					icon={icon}
					onClick={trigger}
				/>
			)}
		/>
	)
}

interface MobileComposerAddSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	mentionPanelStore: MentionPanelStore
	onSelectMention: (
		item: TiptapMentionAttributes,
		context?: MentionSelectContext,
	) => Promise<void>
	/** 引用选择完成且拓展弹窗已关闭后回调，用于恢复底部编辑器焦点 */
	onAfterMentionSelect?: () => void
	onFileUpload: (files: FileList) => void
	mcpStorageKey?: string
	useTempStorage?: boolean
	modules?: MessageEditorModules
}

function MobileComposerAddSheet({
	open,
	onOpenChange,
	selectedTopic,
	selectedProject,
	mentionPanelStore,
	onSelectMention,
	onAfterMentionSelect,
	onFileUpload,
	mcpStorageKey,
	useTempStorage = false,
	modules,
}: MobileComposerAddSheetProps) {
	const { t: tMainInput } = useTranslation("super/mainInput")
	const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(true)
	const mentionTriggerRef = useRef<HTMLDivElement>(null)
	const pluginTriggerRef = useRef<HTMLDivElement>(null)
	const selectedScene = sceneStateStore.currentScene
	const selectedSkillCount = selectedScene ? 1 : 0

	const mentionEnabled = modules?.mention?.enabled !== false
	const uploadEnabled = modules?.upload?.enabled !== false
	const mcpEnabled = modules?.mcp?.enabled !== false
	const mcpAccess = useCreation(
		() =>
			getMCPAccess({
				storageKey: mcpStorageKey ?? selectedProject?.id,
				useTempStorage,
			}),
		[mcpStorageKey, selectedProject?.id, useTempStorage],
	)
	const selectedPluginCount = mcpAccess.mcpList.length

	useEffect(() => {
		if (!open) return
		setIsWebSearchEnabled(internetSearchManager.getIsChecked(selectedTopic?.id))
	}, [open, selectedTopic?.id])

	useEffect(() => {
		void mcpAccess.load().catch(console.error)
	}, [mcpAccess, open])

	const handleToggleWebSearch = useMemoizedFn((nextValue?: boolean) => {
		const resolvedNextValue =
			typeof nextValue === "boolean"
				? nextValue
				: !internetSearchManager.getIsChecked(selectedTopic?.id)
		internetSearchManager.setIsChecked(selectedTopic?.id, resolvedNextValue)
		setIsWebSearchEnabled(resolvedNextValue)
	})

	const handleOpenMention = useMemoizedFn(() => {
		const mentionButton =
			mentionTriggerRef.current?.querySelector<HTMLButtonElement>("[data-at-button]")
		mentionButton?.click()
	})

	const handleSelectMention = useMemoizedFn(
		async (item: TiptapMentionAttributes, context?: MentionSelectContext) => {
			await onSelectMention(item, context)
			onOpenChange(false)
			// 等 MagicPopup 关闭与布局稳定后再聚焦，避免焦点被遮罩层抢走
			window.setTimeout(() => {
				onAfterMentionSelect?.()
			}, 100)
		},
	)

	// const handleOpenSkills = useMemoizedFn(() => {
	// 	handleOpenMention()

	// 	const skillLabels = Array.from(
	// 		new Set([tMainInput("addSheet.actions.skills"), "Skills", "技能"]),
	// 	)
	// 	const tryOpenSkills = (attempt = 0) => {
	// 		const panel = document.querySelector<HTMLElement>("[data-mention-panel]")
	// 		const menuItems = Array.from(
	// 			panel?.querySelectorAll<HTMLElement>('[data-testid="mention-panel-menu-item"]') ??
	// 			[],
	// 		)
	// 		const targetItem = menuItems.find((item) =>
	// 			skillLabels.some((label) => item.textContent?.includes(label)),
	// 		)

	// 		if (targetItem) {
	// 			targetItem.click()
	// 			return
	// 		}

	// 		if (attempt >= 8) return
	// 		window.setTimeout(() => tryOpenSkills(attempt + 1), 50)
	// 	}

	// 	window.setTimeout(() => tryOpenSkills(), 0)
	// })

	const handleOpenPlugin = useMemoizedFn(() => {
		const pluginButton = pluginTriggerRef.current?.querySelector<HTMLButtonElement>(
			'[data-testid="mcp-button"]',
		)
		pluginButton?.click()
	})

	const handleUploadMedia = useMemoizedFn((files: FileList) => {
		if (!files.length) return

		onFileUpload(files)
		onOpenChange(false)
	})

	const webSearchSwitchClassName = cn(
		"pointer-events-none h-[28px] w-[48px] data-[state=checked]:bg-foreground data-[state=unchecked]:bg-border",
		"[&_[data-slot=switch-thumb]]:size-6",
		"[&_[data-slot=switch-thumb]]:bg-background",
		"[&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[calc(100%-2px)]",
	)
	const cameraLabel = tMainInput("addSheet.media.camera")
	const photosLabel = tMainInput("addSheet.media.photos")
	const filesLabel = tMainInput("addSheet.media.files")

	return (
		<>
			<MagicPopup
				visible={open}
				onClose={() => onOpenChange(false)}
				className="rounded-t-[14px] border-0 bg-muted "
				bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
				handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
				title={tMainInput("addSheet.title")}
			>
				<div
					className="flex flex-col gap-2 overflow-hidden bg-muted"
					data-testid="mobile-composer-add-sheet"
				>
					<div className="relative flex h-14 flex-row items-center justify-center">
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
							style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
							aria-label={tMainInput("addSheet.closeAriaLabel")}
							data-testid="mobile-composer-add-sheet-close-button"
						>
							<X className="h-[22px] w-[22px] text-foreground" />
						</button>
						<div
							className="max-w-[247px] truncate text-center text-lg font-semibold leading-none text-foreground"
							data-testid="mobile-composer-add-sheet-title"
						>
							{tMainInput("addSheet.title")}
						</div>
					</div>

					<div
						className="no-scrollbar flex w-full flex-1 flex-col overflow-y-auto px-2 pb-6"
						data-testid="mobile-composer-add-sheet-content"
					>
						{uploadEnabled && (
							<div
								className="flex w-full items-stretch gap-2"
								data-testid="mobile-composer-add-sheet-media"
							>
								<MediaUploadAction
									label={cameraLabel}
									dataTestId="mobile-composer-add-sheet-camera-button"
									icon={Camera}
									accept="image/*"
									capture="environment"
									onFileChange={handleUploadMedia}
								/>
								<MediaUploadAction
									label={photosLabel}
									dataTestId="mobile-composer-add-sheet-photos-button"
									icon={ImageIcon}
									accept="image/*"
									multiple
									onFileChange={handleUploadMedia}
								/>
								<MediaUploadAction
									label={filesLabel}
									dataTestId="mobile-composer-add-sheet-files-button"
									icon={FileUp}
									multiple
									onFileChange={handleUploadMedia}
								/>
							</div>
						)}

						{uploadEnabled && <div className="my-[14px] h-px w-full bg-border" />}

						<div
							className="w-full px-3.5"
							data-testid="mobile-composer-add-sheet-actions"
						>
							{mentionEnabled && (
								<button
									type="button"
									onClick={handleOpenMention}
									className="relative flex h-12 w-full items-center justify-between gap-2.5 active:opacity-60"
									data-testid="mobile-composer-add-sheet-mention-button"
								>
									<div className="flex min-w-0 flex-1 items-center gap-2">
										<div className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
											<AtSign className="h-5 w-5" />
										</div>
										<span className="text-base leading-none text-foreground">
											{tMainInput("addSheet.actions.mention")}
										</span>
									</div>
									<ChevronRight
										className="size-5 shrink-0 text-foreground"
										data-testid="mobile-composer-add-sheet-mention-arrow"
										aria-hidden="true"
									/>
									<div
										ref={mentionTriggerRef}
										className="absolute h-0 w-0 overflow-hidden opacity-0"
									>
										<At
											onSelect={handleSelectMention}
											showText={false}
											iconSize={18}
											mentionPanelStore={mentionPanelStore}
											mobileClassName="!h-8 !w-8 !rounded-full !border-0 !bg-transparent !p-0"
										/>
									</div>
								</button>
							)}

							<button
								type="button"
								onClick={() => handleToggleWebSearch()}
								className="flex h-12 w-full items-center justify-between gap-2.5 active:opacity-60"
								data-testid="mobile-composer-add-sheet-web-search-button"
							>
								<div className="flex min-w-0 flex-1 items-center gap-2">
									<div className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
										<Globe className="h-5 w-5" />
									</div>
									<span className="text-base leading-none text-foreground">
										{tMainInput("addSheet.actions.webSearch")}
									</span>
								</div>
								<Switch
									checked={isWebSearchEnabled}
									onCheckedChange={handleToggleWebSearch}
									className={webSearchSwitchClassName}
								/>
							</button>

							{/* <button
								type="button"
								onClick={handleOpenSkills}
								className="flex h-12 w-full items-center justify-between gap-2.5 active:opacity-60"
								data-testid="mobile-composer-add-sheet-skills-button"
							>
								<div className="flex min-w-0 flex-1 items-center gap-2">
									<div className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
										<Puzzle className="h-5 w-5" />
									</div>
									<ActionLabel
										label={tMainInput("addSheet.actions.skills")}
										count={selectedSkillCount}
									/>
								</div>
								<AddActionPill label={tMainInput("addSheet.addButton")} />
							</button> */}

							{mcpEnabled && (
								<button
									type="button"
									onClick={handleOpenPlugin}
									className="flex h-12 w-full items-center justify-between gap-2.5 active:opacity-60"
									data-testid="mobile-composer-add-sheet-plugin-button"
								>
									<div className="flex min-w-0 flex-1 items-center gap-2">
										<div className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
											<Plug className="h-5 w-5" />
										</div>
										<ActionLabel
											label={tMainInput("addSheet.actions.plugin")}
											count={selectedPluginCount}
										/>
									</div>
									<AddActionPill label={tMainInput("addSheet.addButton")} />
								</button>
							)}

							{mcpEnabled && (
								<div
									ref={pluginTriggerRef}
									className="absolute h-0 w-0 overflow-hidden opacity-0"
								>
									<MCPButton
										iconSize={18}
										size="mobile"
										storageKey={mcpStorageKey ?? selectedProject?.id}
										useTempStorage={useTempStorage}
										className="h-8 w-8"
									/>
								</div>
							)}
						</div>
					</div>
				</div>
			</MagicPopup>
		</>
	)
}

export default observer(MobileComposerAddSheet)
