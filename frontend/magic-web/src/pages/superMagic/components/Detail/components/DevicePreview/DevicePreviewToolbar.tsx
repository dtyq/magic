import { useEffect, useState, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Switch } from "@/components/shadcn-ui/switch"
import { NativeSelect } from "@/components/shadcn-ui/native-select"
import { cn } from "@/utils/cn"
import { DevicePicker } from "./DevicePicker"
import {
	DEVICE_PREVIEW_ZOOMS,
	MIN_PREVIEW_DIMENSION,
	MAX_PREVIEW_DIMENSION,
	isValidDeviceDimension,
} from "./constants"
import { getDevicePreset } from "./devices"
import { rotateDevice, toggleDevicePosture } from "./useDevicePreview"
import type { DevicePreviewControls } from "./types"

export function DevicePreviewToolbar({
	contentScaled = false,
	...controls
}: DevicePreviewControls & { contentScaled?: boolean }) {
	const { config, setConfig, identity } = controls
	const { t } = useTranslation("super")
	const [draft, setDraft] = useState({
		width: String(config.width),
		height: String(config.height),
	})
	const [invalid, setInvalid] = useState(false)
	const [container, setContainer] = useState<HTMLElement | null>(null)
	function resetDraft() {
		setDraft({ width: String(config.width), height: String(config.height) })
		setInvalid(false)
	}
	useEffect(resetDraft, [config.width, config.height, identity])
	useEffect(() => {
		const syncContainer = () =>
			setContainer(
				document.fullscreenElement instanceof HTMLElement
					? document.fullscreenElement
					: null,
			)
		syncContainer()
		document.addEventListener("fullscreenchange", syncContainer)
		return () => document.removeEventListener("fullscreenchange", syncContainer)
	}, [])
	function commit() {
		const width = Number(draft.width),
			height = Number(draft.height)
		if (!isValidDeviceDimension(width) || !isValidDeviceDimension(height)) {
			setInvalid(true)
			return
		}
		setInvalid(false)
		if (width !== config.width || height !== config.height)
			setConfig({ ...config, width, height, preset: "custom" })
	}
	function onInputKey(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter") {
			event.preventDefault()
			commit()
		}
		if (event.key === "Escape") {
			event.preventDefault()
			event.stopPropagation()
			resetDraft()
		}
	}
	return (
		<div className="shrink-0 border-b bg-muted/50 text-xs" data-testid="device-preview-toolbar">
			<div className="flex min-h-8 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-1 [&_button]:[@media(pointer:coarse)]:min-h-11 [&_input]:[@media(pointer:coarse)]:min-h-11 [&_input]:[@media(pointer:coarse)]:text-base">
				<DevicePicker {...controls} container={container} />
				{config.kind === "foldable" && (
					<div
						role="group"
						aria-label={t("fileViewer.devicePreview.posture")}
						className="flex gap-px rounded-sm border p-px"
					>
						{(["folded", "unfolded"] as const).map((posture) => (
							<Button
								key={posture}
								variant="ghost"
								className={cn(
									"h-5 rounded-sm px-1.5 text-xs font-normal",
									config.fold.posture === posture && "bg-background shadow-sm",
								)}
								aria-pressed={config.fold.posture === posture}
								onClick={() => {
									if (config.fold.posture !== posture)
										setConfig(toggleDevicePosture(config))
								}}
							>
								{posture === "folded"
									? t("fileViewer.devicePreview.folded")
									: t("fileViewer.devicePreview.unfolded")}
							</Button>
						))}
					</div>
				)}
				<div className="flex items-center gap-1">
					<Input
						type="number"
						min={MIN_PREVIEW_DIMENSION}
						max={MAX_PREVIEW_DIMENSION}
						step={1}
						aria-label={t("fileViewer.devicePreview.width")}
						aria-invalid={invalid}
						className="h-[22px] w-[49px] rounded-sm bg-background px-1 text-center text-xs tabular-nums shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						value={draft.width}
						onChange={(event) => setDraft({ ...draft, width: event.target.value })}
						onBlur={commit}
						onKeyDown={onInputKey}
					/>
					<span aria-hidden className="text-muted-foreground">
						×
					</span>
					<Input
						type="number"
						min={MIN_PREVIEW_DIMENSION}
						max={MAX_PREVIEW_DIMENSION}
						step={1}
						aria-label={t("fileViewer.devicePreview.height")}
						aria-invalid={invalid}
						className="h-[22px] w-[49px] rounded-sm bg-background px-1 text-center text-xs tabular-nums shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						value={draft.height}
						onChange={(event) => setDraft({ ...draft, height: event.target.value })}
						onBlur={commit}
						onKeyDown={onInputKey}
					/>
				</div>
				<NativeSelect
					className="h-[22px] rounded-sm border-0 py-0 pl-1 text-xs shadow-none"
					value={config.zoom}
					aria-label={t("fileViewer.devicePreview.zoom")}
					onChange={(event) => {
						const zoom = DEVICE_PREVIEW_ZOOMS.find(
							(value) => String(value) === event.target.value,
						)
						if (zoom !== undefined) setConfig({ ...config, zoom })
					}}
				>
					{DEVICE_PREVIEW_ZOOMS.map((zoom) => (
						<option key={zoom} value={zoom}>
							{zoom === "fit" ? t("fileViewer.devicePreview.fit") : `${zoom * 100}%`}
						</option>
					))}
				</NativeSelect>
				<Button
					variant="ghost"
					className="size-[22px] rounded-sm p-0"
					aria-label={t("fileViewer.devicePreview.rotate")}
					onClick={() => setConfig(rotateDevice(config))}
				>
					<RotateCw size={16} />
				</Button>
				<span className="h-3.5 w-px bg-border" aria-hidden />
				<label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
					<Switch
						className="h-3.5 w-6 [&_[data-slot=switch-thumb]]:size-3 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-2.5"
						checked={config.showFrame}
						onCheckedChange={(showFrame) => setConfig({ ...config, showFrame })}
					/>
					{t("fileViewer.devicePreview.frame")}
				</label>
				{getDevicePreset(config.preset)?.reference && (
					<span className="text-[11px] text-muted-foreground">
						{t("fileViewer.devicePreview.reference")}
					</span>
				)}
				{contentScaled && (
					<span className="text-[11px] text-muted-foreground">
						{t("fileViewer.devicePreview.contentScaled")}
					</span>
				)}
			</div>
			{invalid && (
				<div role="alert" className="px-3 pb-1 text-destructive">
					{t("fileViewer.devicePreview.invalidDimensions", {
						min: MIN_PREVIEW_DIMENSION,
						max: MAX_PREVIEW_DIMENSION,
					})}
				</div>
			)}
		</div>
	)
}
