import { useEffect, useId, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Play, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import {
	isDirectionalTransition,
	parsePPTTransition,
	type PPTTransition,
} from "../utils/pptTransitions"
import {
	commonTransitionField,
	getRawTransition,
	transitionRecord,
	type TransitionScope,
} from "./pptTransitionDraft"
import { usePPTTransitionDraft, type PPTTransitionPanelProps } from "./usePPTTransitionDraft"
import PPTTransitionPreview from "./PPTTransitionPreview"
import PPTTransitionDurationInput from "./PPTTransitionDurationInput"

export type { PPTTransitionPanelProps } from "./usePPTTransitionDraft"

export default function PPTTransitionPanel(props: PPTTransitionPanelProps) {
	const { t } = useTranslation("super")
	const mobile = useIsMobile()
	const reducedMotion = Boolean(useReducedMotion())
	const draft = usePPTTransitionDraft(props)
	const [previewRun, setPreviewRun] = useState(0)
	const [previewReady, setPreviewReady] = useState(false)
	const [panelElement, setPanelElement] = useState<HTMLElement | null>(null)
	const closeFocus = useRef<HTMLElement | null>(null)
	const opener = useRef<HTMLElement | null>(null)
	const closeButton = useRef<HTMLButtonElement>(null)
	const scopeLabelId = useId()
	const presets = {
		none: t("ppt.transitions.none"),
		fade: t("ppt.transitions.fade"),
		push: t("ppt.transitions.push"),
		cover: t("ppt.transitions.cover"),
		wipe: t("ppt.transitions.wipe"),
		zoom: t("ppt.transitions.zoom"),
	}
	const directions = [
		{ value: "left", label: t("ppt.transitions.left"), icon: ArrowLeft },
		{ value: "right", label: t("ppt.transitions.right"), icon: ArrowRight },
		{ value: "up", label: t("ppt.transitions.up"), icon: ArrowUp },
		{ value: "down", label: t("ppt.transitions.down"), icon: ArrowDown },
	] as const
	const effect = commonTransitionField(draft.transitions, "effect")
	const animated = draft.transitions.filter((value) => value.effect !== "none")
	const directional = animated.filter((value) => isDirectionalTransition(value.effect))
	const duration = commonTransitionField(animated, "duration_ms")
	const easing = commonTransitionField(animated, "easing")
	const direction = commonTransitionField(directional, "direction")
	const locked = props.busy || draft.saving
	const overrides = transitionRecord(transitionRecord(draft.session.config).slides)
	const overrideCount = draft.session.slides.filter((slide) =>
		Object.hasOwn(overrides, slide.path),
	).length
	const inherited =
		draft.inherit ||
		(!draft.dirty &&
			draft.scope !== "all" &&
			draft.paths.every((path) => !Object.hasOwn(overrides, path)))
	const unsupported =
		!draft.replacesTransition &&
		!draft.inherit &&
		draft.paths.some((path) => {
			const raw = getRawTransition(
				draft.session.config,
				draft.scope === "all" ? undefined : path,
			)
			return raw !== undefined && !parsePPTTransition(raw)
		})
	const defaultEffect =
		parsePPTTransition(getRawTransition(draft.session.config))?.effect ?? "none"
	const target =
		draft.scope === "all"
			? t("ppt.transitions.all")
			: draft.scope === "selected"
				? t("ppt.transitions.selected", { count: draft.paths.length })
				: draft.session.slides.find((slide) => slide.path === draft.session.activePath)
						?.label
	// Keep playback configuration stable; typing parameters must not autoplay the preview.
	const [previewTransition, setPreviewTransition] = useState<PPTTransition>({ effect: "none" })
	const requestClose = () => {
		closeFocus.current = document.activeElement as HTMLElement | null
		void draft.requestClose()
	}
	useEffect(() => {
		if (!props.open) return
		opener.current = document.activeElement as HTMLElement | null
		closeButton.current?.focus()
		return () => {
			if (opener.current?.isConnected) opener.current.focus()
		}
	}, [props.open])
	if (!props.open) return null
	return (
		<aside
			ref={setPanelElement}
			aria-label={t("ppt.transitions.title")}
			data-testid="ppt-transition-panel"
			// Stay in the PPT flex layout; only the settings body scrolls, never the actions.
			className={
				mobile
					? "relative flex h-[45%] max-h-[360px] min-h-0 w-full shrink-0 flex-col border-t bg-background"
					: "relative flex h-full min-h-0 w-[320px] shrink-0 flex-col border-l bg-background xl:w-[360px]"
			}
			onKeyDown={(event) => {
				if (event.key !== "Escape" || event.defaultPrevented || draft.confirmClose) return
				event.preventDefault()
				event.stopPropagation()
				requestClose()
			}}
		>
			<header className="flex shrink-0 flex-col gap-1.5 border-b p-4 pr-14">
				<h2 className="font-semibold text-foreground">{t("ppt.transitions.title")}</h2>
				<p className="text-sm text-muted-foreground">{target}</p>
				<Button
					variant="ghost"
					size="icon"
					className="absolute right-3 top-3"
					ref={closeButton}
					aria-label={t("ppt.transitions.close")}
					onClick={requestClose}
					disabled={locked}
				>
					<X size={16} />
				</Button>
			</header>
			<ScrollArea className="min-h-0 flex-1" viewportClassName="overscroll-contain">
				<div className="space-y-5 p-4">
					{unsupported && (
						<p role="status" className="text-sm text-muted-foreground">
							{t("ppt.transitions.unsupported")}
						</p>
					)}
					<p className="text-sm text-muted-foreground">
						{inherited
							? t("ppt.transitions.inherited", { effect: presets[defaultEffect] })
							: effect
								? presets[effect]
								: t("ppt.transitions.mixed")}
					</p>
					<fieldset disabled={locked} className="space-y-2">
						<legend className="mb-2 text-sm font-medium">
							{t("ppt.transitions.effect")}
						</legend>
						<div className="grid grid-cols-3 gap-2">
							{(Object.keys(presets) as Array<keyof typeof presets>).map((value) => (
								<Button
									key={value}
									variant={effect === value ? "default" : "outline"}
									className="px-2 text-xs"
									aria-pressed={effect === value}
									onClick={() => draft.selectEffect(value)}
								>
									{presets[value]}
								</Button>
							))}
						</div>
					</fieldset>
					{directional.length > 0 && (
						<fieldset disabled={locked} className="space-y-2">
							<legend className="mb-2 text-sm font-medium">
								{t("ppt.transitions.direction")}
							</legend>
							<div className="grid grid-cols-4 gap-2">
								{directions.map(({ value, label, icon: Icon }) => (
									<Button
										key={value}
										variant={direction === value ? "default" : "outline"}
										aria-label={label}
										aria-pressed={direction === value}
										onClick={() => draft.changeParameter({ direction: value })}
									>
										<Icon size={16} />
									</Button>
								))}
							</div>
						</fieldset>
					)}
					{animated.length > 0 && (
						<div className="space-y-4">
							<PPTTransitionDurationInput
								value={duration}
								disabled={locked}
								onChange={(duration_ms) => draft.changeParameter({ duration_ms })}
							/>
							<div className="space-y-2">
								<p className="text-sm font-medium">{t("ppt.transitions.easing")}</p>
								<div className="grid grid-cols-2 gap-2">
									<Button
										variant={easing === "ease-in-out" ? "default" : "outline"}
										aria-pressed={easing === "ease-in-out"}
										disabled={locked}
										onClick={() =>
											draft.changeParameter({ easing: "ease-in-out" })
										}
									>
										{t("ppt.transitions.smooth")}
									</Button>
									<Button
										variant={easing === "linear" ? "default" : "outline"}
										aria-pressed={easing === "linear"}
										disabled={locked}
										onClick={() => draft.changeParameter({ easing: "linear" })}
									>
										{t("ppt.transitions.linear")}
									</Button>
								</div>
							</div>
						</div>
					)}
					<PPTTransitionPreview
						transition={previewTransition}
						run={previewRun}
						reducedMotion={reducedMotion}
						source={props.previewSource}
						onReadyChange={setPreviewReady}
					/>
					<Button
						variant="outline"
						className="w-full"
						disabled={locked || !previewReady}
						onClick={() => {
							const activeIndex = draft.paths.indexOf(draft.session.activePath)
							setPreviewTransition(
								draft.transitions[activeIndex] ??
									draft.transitions[0] ?? { effect: "none" },
							)
							setPreviewRun((value) => value + 1)
						}}
					>
						<Play size={16} />
						{t("ppt.transitions.preview")}
					</Button>
					{!effect && (
						<p className="text-xs text-muted-foreground">
							{t("ppt.transitions.previewFirst")}
						</p>
					)}
					{reducedMotion && (
						<p role="status" className="text-xs text-muted-foreground">
							{t("ppt.transitions.reducedMotion")}
						</p>
					)}
					<div className="space-y-2">
						<label id={scopeLabelId} className="text-sm font-medium">
							{t("ppt.transitions.scope")}
						</label>
						<Select
							value={draft.scope}
							disabled={locked}
							onValueChange={(value) => {
								draft.setScope(value as TransitionScope)
							}}
						>
							<SelectTrigger aria-labelledby={scopeLabelId}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent
								// Share the preview's stacking/fullscreen tree, outside the scroll viewport.
								container={panelElement}
								collisionBoundary={panelElement}
								onEscapeKeyDown={(event) => event.stopPropagation()}
							>
								<SelectItem value="current">
									{t("ppt.transitions.current")}
								</SelectItem>
								{draft.session.selectedPaths.length > 0 && (
									<SelectItem value="selected">
										{t("ppt.transitions.selected", {
											count: draft.session.selectedPaths.length,
										})}
									</SelectItem>
								)}
								<SelectItem value="all">{t("ppt.transitions.all")}</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{draft.scope === "all" ? (
						<p className="text-sm text-muted-foreground">
							{t("ppt.transitions.replaceOverrides", { count: overrideCount })}
						</p>
					) : (
						<Button
							variant="outline"
							className="w-full"
							disabled={locked}
							onClick={draft.restoreDefault}
						>
							{t("ppt.transitions.useDefault")}
						</Button>
					)}
				</div>
			</ScrollArea>
			<footer className="flex shrink-0 flex-col gap-2 border-t p-4">
				{(draft.failed || draft.identityChanged) && (
					<p role="alert" className="text-sm text-destructive">
						{draft.identityChanged
							? t("ppt.transitions.deckChanged")
							: t("ppt.transitions.saveFailed")}
					</p>
				)}
				<Button
					disabled={
						locked || !draft.dirty || draft.identityChanged || !draft.paths.length
					}
					onClick={() => void draft.save()}
				>
					{draft.saving ? t("ppt.saving") : t("ppt.transitions.save")}
				</Button>
			</footer>
			<AlertDialog
				open={draft.confirmClose}
				onOpenChange={(open) => {
					if (!open && !locked) draft.finishClose(false)
				}}
			>
				<AlertDialogContent
					onOpenAutoFocus={() => {
						closeFocus.current = document.activeElement as HTMLElement | null
					}}
					onCloseAutoFocus={(event) => {
						event.preventDefault()
						if (closeFocus.current?.isConnected) closeFocus.current.focus()
					}}
				>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("ppt.transitions.unsavedTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("ppt.transitions.unsavedDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{(draft.failed || draft.identityChanged) && (
						<p role="alert" className="text-sm text-destructive">
							{draft.identityChanged
								? t("ppt.transitions.deckChanged")
								: t("ppt.transitions.saveFailed")}
						</p>
					)}
					<AlertDialogFooter>
						<Button
							variant="outline"
							disabled={locked}
							onClick={() => draft.finishClose(false)}
						>
							{t("common.cancel")}
						</Button>
						<Button
							variant="secondary"
							disabled={locked}
							onClick={() => draft.finishClose(true)}
						>
							{t("ppt.discardChanges")}
						</Button>
						<Button
							disabled={locked || draft.identityChanged}
							onClick={() => void draft.save()}
						>
							{draft.saving ? t("ppt.saving") : t("ppt.transitions.save")}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</aside>
	)
}
