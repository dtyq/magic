import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDebounceFn } from "ahooks"
import { ImageUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Slider } from "@/components/shadcn-ui/slider"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { StyleSectionProps } from "../types"

type BackgroundType = "solid" | "linear-gradient" | "radial-gradient" | "image"

interface ColorStop {
	id: string
	color: string
	position: number
}

function parseColorStops(stopsStr: string): ColorStop[] {
	const stops = stopsStr.split(",").map((stop) => stop.trim())
	return stops
		.map((stop, index) => {
			const match = stop.match(/^(#[0-9a-f]{6}|rgb\(.+\))\s+(\d+)%$/i)
			if (!match) {
				return null
			}

			return {
				id: String(index + 1),
				color: match[1],
				position: Number.parseInt(match[2], 10),
			}
		})
		.filter((stop): stop is ColorStop => stop !== null)
}

function extractImageUrl(backgroundImage: string): string | null {
	if (!backgroundImage || backgroundImage === "none") {
		return null
	}

	const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/i)
	return match?.[2] || null
}

function getDefaultColorStops(): ColorStop[] {
	return [
		{ id: "1", color: "#3b82f6", position: 0 },
		{ id: "2", color: "#8b5cf6", position: 100 },
	]
}

const BackgroundSection = observer(function BackgroundSection({
	selectedElement,
	editorRef,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles
	const currentBgColor = computedStyles?.backgroundColor || "transparent"
	const currentBgImage = computedStyles?.backgroundImage || "none"
	const hasBackgroundImage = Boolean(extractImageUrl(currentBgImage))
	const isImageElement = selectedElement?.tagName?.toLowerCase() === "img"

	const [bgType, setBgType] = useState<BackgroundType>("solid")
	const [solidColor, setSolidColor] = useState(currentBgColor)
	const [gradientAngle, setGradientAngle] = useState(90)
	const [colorStops, setColorStops] = useState<ColorStop[]>(getDefaultColorStops())
	const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null)
	const [isImageActionLoading, setIsImageActionLoading] = useState(false)

	const generateGradientCSS = useCallback(
		(
			type: Extract<
				BackgroundType,
				"linear-gradient" | "radial-gradient"
			> = "linear-gradient",
			stops: ColorStop[] = colorStops,
			angle: number = gradientAngle,
		) => {
			const sortedStops = [...stops].sort((a, b) => a.position - b.position)
			const stopsStr = sortedStops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")

			if (type === "linear-gradient") {
				return `linear-gradient(${angle}deg, ${stopsStr})`
			}

			return `radial-gradient(circle, ${stopsStr})`
		},
		[colorStops, gradientAngle],
	)

	useEffect(() => {
		const nextPreviewUrl = extractImageUrl(currentBgImage)
		setBackgroundPreviewUrl(nextPreviewUrl)

		if (nextPreviewUrl) {
			setBgType("image")
			return
		}

		const linearMatch = currentBgImage.match(/linear-gradient\(\s*(\d+)deg\s*,\s*(.+)\)/i)
		if (linearMatch) {
			const parsedStops = parseColorStops(linearMatch[2])
			setBgType("linear-gradient")
			setGradientAngle(Number.parseInt(linearMatch[1], 10))
			if (parsedStops.length >= 2) {
				setColorStops(parsedStops)
			}
			return
		}

		const radialMatch = currentBgImage.match(/radial-gradient\(\s*circle\s*,\s*(.+)\)/i)
		if (radialMatch) {
			const parsedStops = parseColorStops(radialMatch[1])
			setBgType("radial-gradient")
			if (parsedStops.length >= 2) {
				setColorStops(parsedStops)
			}
			return
		}

		setBgType("solid")
		setSolidColor(currentBgColor !== "transparent" ? currentBgColor : "#ffffff")
	}, [currentBgColor, currentBgImage])

	const { run: applyBackgroundDebounced } = useDebounceFn(
		(type: BackgroundType, color: string, gradient: string) => {
			if (type === "solid") {
				onStyleChange?.("backgroundColor", color)
				onStyleChange?.("backgroundImage", "none")
				return
			}

			if (type === "linear-gradient" || type === "radial-gradient") {
				onStyleChange?.("backgroundColor", "transparent")
				onStyleChange?.("backgroundImage", gradient)
			}
		},
		{ wait: 300 },
	)

	const { run: applyGradientDebounced } = useDebounceFn(
		(
			type: Extract<BackgroundType, "linear-gradient" | "radial-gradient">,
			stops: ColorStop[],
			angle: number,
		) => {
			onStyleChange?.("backgroundColor", "transparent")
			onStyleChange?.("backgroundImage", generateGradientCSS(type, stops, angle))
		},
		{ wait: 300 },
	)

	const handleBgTypeChange = useCallback(
		(value: BackgroundType) => {
			setBgType(value)

			if (value === "image") {
				return
			}

			if (value === "solid") {
				onStyleChange?.("backgroundColor", solidColor)
				onStyleChange?.("backgroundImage", "none")
				return
			}

			onStyleChange?.("backgroundColor", "transparent")
			onStyleChange?.(
				"backgroundImage",
				generateGradientCSS(value, colorStops, gradientAngle),
			)
		},
		[solidColor, onStyleChange, generateGradientCSS, colorStops, gradientAngle],
	)

	const handleSolidColorChange = useCallback(
		(value: string) => {
			setSolidColor(value)
			if (bgType === "solid") {
				applyBackgroundDebounced(bgType, value, "")
			}
		},
		[bgType, applyBackgroundDebounced],
	)

	const handleAddColorStop = useCallback(() => {
		const newStop: ColorStop = {
			id: String(Date.now()),
			color: "#6366f1",
			position: 50,
		}
		setColorStops((prevStops) => [...prevStops, newStop])
	}, [])

	const handleRemoveColorStop = useCallback((id: string) => {
		setColorStops((prevStops) => {
			if (prevStops.length <= 2) {
				return prevStops
			}

			return prevStops.filter((stop) => stop.id !== id)
		})
	}, [])

	const handleColorStopColorChange = useCallback(
		(id: string, color: string) => {
			setColorStops((prevStops) => {
				const nextStops = prevStops.map((stop) =>
					stop.id === id ? { ...stop, color } : stop,
				)
				if (bgType === "linear-gradient" || bgType === "radial-gradient") {
					applyGradientDebounced(bgType, nextStops, gradientAngle)
				}
				return nextStops
			})
		},
		[bgType, gradientAngle, applyGradientDebounced],
	)

	const handleColorStopPositionChange = useCallback(
		(id: string, position: number) => {
			setColorStops((prevStops) => {
				const nextStops = prevStops.map((stop) =>
					stop.id === id ? { ...stop, position } : stop,
				)
				if (bgType === "linear-gradient" || bgType === "radial-gradient") {
					applyGradientDebounced(bgType, nextStops, gradientAngle)
				}
				return nextStops
			})
		},
		[bgType, gradientAngle, applyGradientDebounced],
	)

	const handleRunImageAction = useCallback(
		async (action: "set-element-background-image" | "remove-element-background-image") => {
			if (!editorRef.current || isImageElement) {
				return
			}

			try {
				setIsImageActionLoading(true)
				await editorRef.current.runImageAction({ action })
			} catch (error) {
				console.error("[BackgroundSection] Failed to run image action:", error)
			} finally {
				setIsImageActionLoading(false)
			}
		},
		[editorRef, isImageElement],
	)

	return (
		<div className="space-y-4" data-testid="html-style-panel-background-section">
			<div className="space-y-2">
				<h4 className="text-sm font-medium">{t("stylePanel.backgroundStyles")}</h4>
			</div>

			<div className="space-y-2">
				<Label className="text-xs">{t("stylePanel.backgroundType")}</Label>
				<Select
					value={bgType}
					onValueChange={(value) => handleBgTypeChange(value as BackgroundType)}
				>
					<SelectTrigger
						className="h-9"
						data-testid="html-style-panel-background-type-trigger"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent data-testid="html-style-panel-background-type-content">
						<SelectItem value="solid">{t("stylePanel.solidColor")}</SelectItem>
						<SelectItem value="linear-gradient">
							{t("stylePanel.linearGradient")}
						</SelectItem>
						<SelectItem value="radial-gradient">
							{t("stylePanel.radialGradient")}
						</SelectItem>
						<SelectItem value="image">{t("stylePanel.imageBackground")}</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{bgType === "solid" && (
				<div className="space-y-2">
					<Label htmlFor="bg-color" className="text-xs">
						{t("stylePanel.backgroundColor")}
					</Label>
					<div className="flex gap-2">
						<Input
							id="bg-color"
							type="color"
							value={solidColor === "transparent" ? "#ffffff" : solidColor}
							onChange={(e) => handleSolidColorChange(e.target.value)}
							className="h-9 w-16 cursor-pointer p-1"
							data-testid="html-style-panel-background-color-picker"
						/>
						<Input
							type="text"
							value={solidColor}
							onChange={(e) => handleSolidColorChange(e.target.value)}
							placeholder={t("stylePanel.backgroundColorPlaceholder")}
							className="flex-1 font-mono text-xs"
							data-testid="html-style-panel-background-color-input"
						/>
					</div>
				</div>
			)}

			{(bgType === "linear-gradient" || bgType === "radial-gradient") && (
				<>
					{bgType === "linear-gradient" && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs">{t("stylePanel.gradientAngle")}</Label>
								<span className="text-xs text-muted-foreground">
									{gradientAngle}°
								</span>
							</div>
							<Slider
								value={[gradientAngle]}
								onValueChange={([value]) => {
									setGradientAngle(value)
									applyGradientDebounced(bgType, colorStops, value)
								}}
								min={0}
								max={360}
								step={1}
								className="w-full"
								data-testid="html-style-panel-gradient-angle-slider"
							/>
						</div>
					)}

					<div className="space-y-2">
						<Label className="text-xs">{t("stylePanel.gradientPreview")}</Label>
						<div
							className="h-16 w-full rounded-md border"
							style={{
								background: generateGradientCSS(bgType, colorStops, gradientAngle),
							}}
							data-testid="html-style-panel-gradient-preview"
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs">{t("stylePanel.colorStops")}</Label>
							<Button
								size="sm"
								variant="ghost"
								onClick={handleAddColorStop}
								className="h-6 gap-1 px-2 text-xs"
								data-testid="html-style-panel-add-color-stop-button"
							>
								<Plus className="h-3 w-3" />
								{t("stylePanel.addColorStop")}
							</Button>
						</div>

						<ScrollArea className="h-full max-h-60 space-y-3 overflow-y-auto">
							{colorStops.map((stop) => (
								<div key={stop.id} className="space-y-2 rounded-md border p-3">
									<div className="flex gap-2">
										<Input
											type="color"
											value={stop.color}
											onChange={(e) =>
												handleColorStopColorChange(stop.id, e.target.value)
											}
											className="h-9 w-16 cursor-pointer p-1"
											data-testid="html-style-panel-color-stop-picker"
										/>
										<Input
											type="text"
											value={stop.color}
											onChange={(e) =>
												handleColorStopColorChange(stop.id, e.target.value)
											}
											className="flex-1 font-mono text-xs"
											data-testid="html-style-panel-color-stop-input"
										/>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => handleRemoveColorStop(stop.id)}
											disabled={colorStops.length <= 2}
											className="h-9 w-9 p-0"
											data-testid="html-style-panel-remove-color-stop-button"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>

									<div className="space-y-1">
										<div className="flex items-center justify-between">
											<span className="text-xs text-muted-foreground">
												{t("stylePanel.position")}
											</span>
											<span className="text-xs text-muted-foreground">
												{stop.position}%
											</span>
										</div>
										<Slider
											value={[stop.position]}
											onValueChange={([value]) =>
												handleColorStopPositionChange(stop.id, value)
											}
											min={0}
											max={100}
											step={1}
											className="w-full"
											data-testid="html-style-panel-color-stop-position-slider"
										/>
									</div>
								</div>
							))}
						</ScrollArea>
					</div>
				</>
			)}

			{bgType === "image" && (
				<div className="space-y-3" data-testid="html-style-panel-background-image-controls">
					<div className="space-y-2">
						<Label className="text-xs">{t("stylePanel.currentBackgroundImage")}</Label>
						<div
							className="flex h-24 items-center justify-center rounded-md border bg-muted/30 bg-cover bg-center text-xs text-muted-foreground"
							style={
								backgroundPreviewUrl
									? { backgroundImage: `url("${backgroundPreviewUrl}")` }
									: undefined
							}
							data-testid="html-style-panel-background-image-preview"
						>
							{backgroundPreviewUrl ? null : t("stylePanel.noBackgroundImage")}
						</div>
					</div>

					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							className="flex-1"
							onClick={() => handleRunImageAction("set-element-background-image")}
							disabled={isImageActionLoading || isImageElement}
							data-testid="html-style-panel-background-image-upload-button"
						>
							<ImageUp className="mr-2 h-4 w-4" />
							{hasBackgroundImage
								? t("stylePanel.replaceBackgroundImage")
								: t("stylePanel.uploadBackgroundImage")}
						</Button>
						<Button
							type="button"
							variant="ghost"
							className="hover:bg-destructive/10 hover:text-destructive"
							onClick={() => handleRunImageAction("remove-element-background-image")}
							disabled={isImageActionLoading || !hasBackgroundImage || isImageElement}
							data-testid="html-style-panel-background-image-remove-button"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							{t("stylePanel.removeBackgroundImage")}
						</Button>
					</div>
				</div>
			)}
		</div>
	)
})

export default BackgroundSection
