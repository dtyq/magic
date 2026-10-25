import { ErrorBoundary } from "react-error-boundary"
import { Suspense, useId, useRef, useState } from "react"
import { Slot } from "@radix-ui/react-slot"
import {
	autoUpdate,
	flip,
	FloatingFocusManager,
	FloatingPortal,
	offset,
	safePolygon,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useFocus,
	useHover,
	useInteractions,
	useRole,
} from "@floating-ui/react"
import { ArrowRight, MousePointer2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Dialog } from "@/components/shadcn-ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import {
	useOverlayInteractionScopeAttributes,
	useOverlayInteractionScopeContentAttributes,
} from "@/components/shadcn-ui/overlay-interaction-scope"
import { HelpDialogContent, HelpDialogFrame } from "./HelpDialog"
import type { ContextHelpProps, HelpDialogProps } from "./types"

export type { ContextHelpProps, HelpDefinition, HelpDialogProps } from "./types"

// 帮助入口已有悬停反馈，稍作停留再打开卡片以过滤快速经过；点击和键盘聚焦不等待。
const HELP_PREVIEW_OPEN_DELAY = 500

/** 同一个入口负责简介和完整说明；业务只提供内容，不复制浮层状态与焦点逻辑。 */
export function ContextHelp({ help, mode, children, renderDialog, header }: ContextHelpProps) {
	const { t } = useTranslation("interface")
	const [layer, setLayer] = useState<"closed" | "preview" | "dialog">("closed")
	const suppressFocusPreview = useRef(false)
	const titleId = useId()
	const dialogId = useId()
	const triggerScope = useOverlayInteractionScopeAttributes()
	const contentScope = useOverlayInteractionScopeContentAttributes()
	const previewEnabled = mode === "preview" && layer !== "dialog"
	const { refs, floatingStyles, context } = useFloating({
		open: layer === "preview",
		onOpenChange(open, _event, reason) {
			if (open && reason === "focus" && suppressFocusPreview.current) return
			// 键盘已进入说明时，鼠标移出不能让「查看更多」消失。
			if (
				!open &&
				(reason === "hover" || reason === "safe-polygon") &&
				refs.floating.current?.contains(document.activeElement)
			)
				return
			setLayer((current) => (current === "dialog" ? current : open ? "preview" : "closed"))
		},
		placement: "right-start",
		middleware: [offset(4), flip(), shift({ padding: 8 })],
		whileElementsMounted: autoUpdate,
	})
	const hover = useHover(context, {
		enabled: previewEnabled,
		delay: { open: HELP_PREVIEW_OPEN_DELAY },
		mouseOnly: true,
		move: false,
		handleClose: safePolygon(),
	})
	const focus = useFocus(context, { enabled: previewEnabled })
	const click = useClick(context, { enabled: previewEnabled, toggle: false })
	const dismiss = useDismiss(context, { enabled: previewEnabled })
	const role = useRole(context, { role: "dialog", enabled: previewEnabled })
	const { getReferenceProps, getFloatingProps } = useInteractions([
		hover,
		focus,
		click,
		dismiss,
		role,
	])

	function openDialog() {
		suppressFocusPreview.current = true
		setLayer("dialog")
	}

	const trigger = (
		<Slot
			ref={refs.setReference}
			{...getReferenceProps({
				onPointerEnter() {
					// 关闭面板只抑制程序恢复焦点；用户再次悬停时应重新显示简介。
					suppressFocusPreview.current = false
				},
				onPointerDown() {
					suppressFocusPreview.current = false
				},
				onBlur() {
					suppressFocusPreview.current = false
				},
				onClick() {
					if (mode === "dialog") openDialog()
				},
			})}
			{...triggerScope}
			aria-haspopup="dialog"
			aria-expanded={mode === "dialog" ? layer === "dialog" : layer !== "closed"}
			aria-controls={
				layer === "dialog"
					? dialogId
					: mode === "preview" && layer === "preview"
						? context.floatingId
						: undefined
			}
		>
			{children}
		</Slot>
	)

	return (
		<Dialog open={layer === "dialog"} onOpenChange={(open) => !open && setLayer("closed")}>
			{mode === "dialog" ? (
				<Tooltip
					open={layer === "preview"}
					onOpenChange={(open) => {
						if (open && suppressFocusPreview.current) return
						setLayer((current) =>
							current === "dialog" ? current : open ? "preview" : "closed",
						)
					}}
				>
					<TooltipTrigger asChild>{trigger}</TooltipTrigger>
					{/* 简介自然换行，避免均衡折行后气泡宽度仍保留右侧空白。 */}
					<TooltipContent
						side="top"
						className="max-w-[min(18rem,var(--radix-tooltip-content-available-width,100vw))] whitespace-normal text-wrap break-words"
					>
						<p>{help.summary}</p>
						{/* 仅直接打开详情的入口提示点击，不能把先打开预览卡片的行为描述成直接进入教程。 */}
						<div className="border-current/15 mt-1.5 flex items-center gap-1.5 border-t pt-1.5 text-[10px] opacity-80">
							<MousePointer2 size={12} className="shrink-0" aria-hidden />
							<span>{t("contextHelp.clickToViewGuide")}</span>
						</div>
					</TooltipContent>
				</Tooltip>
			) : (
				trigger
			)}
			{mode === "preview" && layer === "preview" && (
				<FloatingPortal>
					<FloatingFocusManager
						context={context}
						modal={false}
						initialFocus={-1}
						returnFocus={false}
					>
						<div
							ref={refs.setFloating}
							style={floatingStyles}
							className="z-tooltip w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md outline-none"
							{...getFloatingProps({
								onPointerDown: (event) => event.stopPropagation(),
								onClick: (event) => event.stopPropagation(),
								onDoubleClick: (event) => event.stopPropagation(),
								onKeyDown: (event) => event.stopPropagation(),
							})}
							{...contentScope}
							aria-labelledby={titleId}
						>
							<div className="flex items-center gap-3">
								{help.identity && (
									<span className="inline-flex shrink-0">
										{help.identity.renderIcon(28)}
									</span>
								)}
								<div className="min-w-0">
									<p id={titleId} className="break-all font-medium">
										{help.identity?.name ?? help.title}
									</p>
									{help.identity && (
										<p className="text-xs text-muted-foreground">
											{help.title}
											{help.identity.scope ? " · " + help.identity.scope : ""}
										</p>
									)}
								</div>
							</div>
							<p className="text-xs leading-5 text-muted-foreground">
								{help.summary}
							</p>
							{help.points?.length ? (
								<ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
									{help.points.map((point) => (
										<li key={point}>{point}</li>
									))}
								</ul>
							) : null}
							<div className="flex justify-end">
								<Button variant="ghost" size="sm" onClick={openDialog}>
									{t("contextHelp.more")}
									<ArrowRight size={16} />
								</Button>
							</div>
						</div>
					</FloatingFocusManager>
				</FloatingPortal>
			)}
			{layer === "dialog" && (
				<CompleteHelpDialog
					help={help}
					id={dialogId}
					header={header}
					renderDialog={renderDialog}
					onCloseAutoFocus={(event) => {
						event.preventDefault()
						// 简介关闭时不恢复焦点；完整面板关闭后才返回原入口，且不立即重开简介。
						suppressFocusPreview.current = true
						const triggerElement = refs.domReference.current
						if (triggerElement instanceof HTMLElement && triggerElement.isConnected)
							triggerElement.focus()
					}}
				/>
			)}
		</Dialog>
	)
}

/** 阅读模块加载失败时保留当前单篇说明和关闭入口；边界必须在 lazy 组件外面。 */
function CompleteHelpDialog({
	renderDialog,
	...props
}: HelpDialogProps & Pick<ContextHelpProps, "renderDialog">) {
	const { t } = useTranslation("interface")
	const navigation = renderDialog ? (
		<p className="p-5" role="status">
			{t("contextHelp.loading")}
		</p>
	) : undefined
	const fallback = <HelpDialogContent {...props} navigation={navigation} />
	return (
		<HelpDialogFrame {...props} hasNavigation={Boolean(renderDialog)}>
			<ErrorBoundary
				fallback={
					<HelpDialogContent
						{...props}
						navigation={
							renderDialog ? (
								<p className="p-5" role="alert">
									{t("contextHelp.loadFailed")}
								</p>
							) : undefined
						}
					/>
				}
			>
				<Suspense fallback={fallback}>
					{renderDialog ? renderDialog(props) : fallback}
				</Suspense>
			</ErrorBoundary>
		</HelpDialogFrame>
	)
}
