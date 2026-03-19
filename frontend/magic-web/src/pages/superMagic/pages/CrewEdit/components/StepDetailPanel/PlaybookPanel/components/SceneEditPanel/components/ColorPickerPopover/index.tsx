import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import Color from "color"
import { Slider } from "radix-ui"
import { Pipette } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"

// ---------------------------------------------------------------------------
// Color conversion helpers
// ---------------------------------------------------------------------------
interface HSLA {
	h: number // 0-360
	s: number // 0-100
	l: number // 0-100
	a: number // 0-100
}

function hexToHsla(hex: string): HSLA {
	try {
		const c = Color(hex)
		return {
			h: Math.round(c.hue()),
			s: Math.round(c.saturationl()),
			l: Math.round(c.lightness()),
			a: Math.round(c.alpha() * 100),
		}
	} catch {
		return { h: 0, s: 100, l: 50, a: 100 }
	}
}

function hslaToHex({ h, s, l }: HSLA): string {
	return Color.hsl(h, s, l).hex().toLowerCase()
}

function hslaToRgb({ h, s, l, a }: HSLA): [number, number, number, number] {
	const arr = Color.hsl(h, s, l).rgb().array().map(Math.round) as [number, number, number]
	return [...arr, a] as [number, number, number, number]
}

/** Convert SL-canvas pointer position (0-1) → saturation & lightness */
function posToSL(x: number, y: number): Pick<HSLA, "s" | "l"> {
	const s = x * 100
	const topL = x < 0.01 ? 100 : 50 + 50 * (1 - x)
	return { s, l: topL * (1 - y) }
}

/** Convert saturation & lightness → SL-canvas pointer position (0-1) */
function slToPos(s: number, l: number): { x: number; y: number } {
	const x = s / 100
	const topL = x < 0.01 ? 100 : 50 + 50 * (1 - x)
	return { x, y: topL > 0 ? 1 - l / topL : 0 }
}

// ---------------------------------------------------------------------------
// SL gradient canvas with draggable pointer
// ---------------------------------------------------------------------------
interface SLCanvasProps {
	hue: number
	saturation: number
	lightness: number
	onChange: (s: number, l: number) => void
}

function SLCanvas({ hue, saturation, lightness, onChange }: SLCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const pos = slToPos(saturation, lightness)

	const applyPointer = useCallback(
		(e: PointerEvent) => {
			if (!containerRef.current) return
			const rect = containerRef.current.getBoundingClientRect()
			const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
			const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
			const { s, l } = posToSL(x, y)
			onChange(s, l)
		},
		[onChange],
	)

	useEffect(() => {
		if (!isDragging) return
		const onMove = (e: PointerEvent) => applyPointer(e)
		const onUp = () => setIsDragging(false)
		window.addEventListener("pointermove", onMove)
		window.addEventListener("pointerup", onUp)
		return () => {
			window.removeEventListener("pointermove", onMove)
			window.removeEventListener("pointerup", onUp)
		}
	}, [isDragging, applyPointer])

	return (
		<div
			ref={containerRef}
			className="relative w-full cursor-crosshair overflow-clip rounded-md"
			style={{
				aspectRatio: "1 / 1",
				background: [
					"linear-gradient(0deg,#000 0%,transparent 100%)",
					`linear-gradient(90deg,#fff 0%,transparent 100%)`,
					`hsl(${hue},100%,50%)`,
				].join(", "),
			}}
			onPointerDown={(e) => {
				e.preventDefault()
				setIsDragging(true)
				applyPointer(e.nativeEvent)
			}}
		>
			{/* Pointer */}
			<div
				className="pointer-events-none absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
				style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
			/>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Hue slider
// ---------------------------------------------------------------------------
function HueSlider({ value, onChange }: { value: number; onChange: (h: number) => void }) {
	return (
		<Slider.Root
			className="relative flex h-[10px] w-full touch-none items-center"
			max={360}
			step={1}
			value={[value]}
			onValueChange={([h]) => onChange(h)}
		>
			<Slider.Track className="relative my-0.5 h-2 w-full grow rounded-full bg-[linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]">
				<Slider.Range className="absolute h-full" />
			</Slider.Track>
			<Slider.Thumb className="block h-[14px] w-[14px] rounded-full border-2 border-white bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] focus-visible:outline-none" />
		</Slider.Root>
	)
}

// ---------------------------------------------------------------------------
// Alpha slider (checkerboard bg + opacity gradient)
// ---------------------------------------------------------------------------
function AlphaSlider({
	value,
	hue,
	saturation,
	lightness,
	onChange,
}: {
	value: number
	hue: number
	saturation: number
	lightness: number
	onChange: (a: number) => void
}) {
	const opaqueColor = Color.hsl(hue, saturation, lightness).hex()
	return (
		<Slider.Root
			className="relative flex h-[10px] w-full touch-none items-center"
			max={100}
			step={1}
			value={[value]}
			onValueChange={([a]) => onChange(a)}
		>
			<Slider.Track
				className="relative my-0.5 h-2 w-full grow overflow-hidden rounded-full"
				style={{
					backgroundImage: [
						`linear-gradient(90deg,transparent,${opaqueColor})`,
						`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='4' height='4' fill='%23ccc'/%3E%3Crect x='4' y='4' width='4' height='4' fill='%23ccc'/%3E%3C/svg%3E")`,
					].join(", "),
				}}
			>
				<Slider.Range className="absolute h-full" />
			</Slider.Track>
			<Slider.Thumb className="block h-[14px] w-[14px] rounded-full border-2 border-white bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] focus-visible:outline-none" />
		</Slider.Root>
	)
}

// ---------------------------------------------------------------------------
// Format inputs
// ---------------------------------------------------------------------------
type ColorFormat = "hex" | "rgb"

interface FormatInputsProps {
	hsla: HSLA
	format: ColorFormat
	onFormatChange: (f: ColorFormat) => void
	onHslaChange: (hsla: HSLA) => void
}

function FormatInputs({ hsla, format, onFormatChange, onHslaChange }: FormatInputsProps) {
	const [hexDraft, setHexDraft] = useState(hslaToHex(hsla))
	const { h, s, l } = hsla

	// Sync draft when h/s/l changes externally (slider, eyedropper)
	useEffect(() => {
		setHexDraft(hslaToHex({ h, s, l, a: 100 }))
	}, [h, s, l])

	function commitHex(raw: string) {
		const v = raw.startsWith("#") ? raw : `#${raw}`
		if (/^#[0-9a-fA-F]{6}$/.test(v)) {
			onHslaChange({ ...hexToHsla(v), a: hsla.a })
		}
	}

	const [r, g, b] = hslaToRgb(hsla)

	function commitRgbChannel(channel: "r" | "g" | "b", raw: string) {
		const n = parseInt(raw, 10)
		if (Number.isNaN(n)) return
		const clamped = Math.max(0, Math.min(255, n))
		const newRgb: [number, number, number] = [r, g, b]
		const idx = { r: 0, g: 1, b: 2 }[channel]
		newRgb[idx] = clamped
		const c = Color.rgb(...newRgb)
		onHslaChange({
			h: Math.round(c.hue()),
			s: Math.round(c.saturationl()),
			l: Math.round(c.lightness()),
			a: hsla.a,
		})
	}

	return (
		<div className="flex items-center gap-2">
			{/* Format selector */}
			<Select value={format} onValueChange={(v) => onFormatChange(v as ColorFormat)}>
				<SelectTrigger className="h-9 w-[72px] text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="hex">HEX</SelectItem>
					<SelectItem value="rgb">RGB</SelectItem>
				</SelectContent>
			</Select>

			{/* Value inputs */}
			{format === "hex" ? (
				<div className="shadow-xs flex flex-1 items-center overflow-hidden rounded-md border border-input">
					<Input
						value={hexDraft}
						onChange={(e) => setHexDraft(e.target.value)}
						onBlur={(e) => commitHex(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && commitHex(hexDraft)}
						className="h-9 flex-1 rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
						maxLength={7}
						spellCheck={false}
					/>
					<div className="h-5 w-px shrink-0 bg-border" />
					<Input
						value={`${hsla.a}%`}
						readOnly
						className="h-9 w-14 shrink-0 rounded-none border-0 text-center text-xs shadow-none focus-visible:ring-0"
					/>
				</div>
			) : (
				<div className="shadow-xs flex flex-1 items-center overflow-hidden rounded-md border border-input">
					{([r, g, b] as number[]).map((val, i) => (
						<>
							{i > 0 && (
								<div key={`sep-${i}`} className="h-5 w-px shrink-0 bg-border" />
							)}
							<Input
								key={i}
								value={val}
								onChange={(e) =>
									commitRgbChannel(
										["r", "g", "b"][i] as "r" | "g" | "b",
										e.target.value,
									)
								}
								className="h-9 min-w-0 flex-1 rounded-none border-0 text-center text-xs shadow-none focus-visible:ring-0"
								type="number"
								min={0}
								max={255}
							/>
						</>
					))}
					<div className="h-5 w-px shrink-0 bg-border" />
					<Input
						value={`${hsla.a}%`}
						readOnly
						className="h-9 w-14 shrink-0 rounded-none border-0 text-center text-xs shadow-none focus-visible:ring-0"
					/>
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------
// Main ColorPickerPopover
// ---------------------------------------------------------------------------
interface ColorPickerPopoverProps {
	value: string
	onChange: (color: string) => void
	children: React.ReactNode
}

export function ColorPickerPopover({ value, onChange, children }: ColorPickerPopoverProps) {
	const { t } = useTranslation("crew/create")
	const [hsla, setHsla] = useState<HSLA>(() => hexToHsla(value))
	const [format, setFormat] = useState<ColorFormat>("hex")

	// Sync internal state when popover opens / value changes externally
	function handleOpenChange(open: boolean) {
		if (open) setHsla(hexToHsla(value))
	}

	function update(next: HSLA) {
		setHsla(next)
		onChange(hslaToHex(next))
	}

	async function handleEyeDropper() {
		try {
			// @ts-expect-error - EyeDropper is experimental
			const result = await new EyeDropper().open()
			const next = { ...hexToHsla(result.sRGBHex), a: hsla.a }
			setHsla(next)
			onChange(result.sRGBHex.toLowerCase())
		} catch {
			// cancelled or not supported
		}
	}

	return (
		<Popover onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				className="w-[280px] p-3.5"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex flex-col gap-2">
					{/* Title */}
					<p className="text-sm font-semibold text-foreground">
						{t("playbook.edit.basicInfo.colorPicker.title")}
					</p>

					{/* SL gradient canvas */}
					<SLCanvas
						hue={hsla.h}
						saturation={hsla.s}
						lightness={hsla.l}
						onChange={(s, l) => update({ ...hsla, s, l })}
					/>

					{/* Preview + eyedropper + sliders */}
					<div className="flex items-center gap-2">
						{/* Color preview block */}
						<div
							className="h-9 w-9 shrink-0 rounded-md border border-border"
							style={{
								backgroundColor: `hsla(${hsla.h},${hsla.s}%,${hsla.l}%,${hsla.a / 100})`,
							}}
						/>
						{/* Eye dropper */}
						<Button
							variant="outline"
							size="icon"
							className="shadow-xs h-9 w-9 shrink-0"
							onClick={handleEyeDropper}
							type="button"
						>
							<Pipette className="h-4 w-4" />
						</Button>
						{/* Sliders */}
						<div className="flex flex-1 flex-col gap-2">
							<HueSlider value={hsla.h} onChange={(h) => update({ ...hsla, h })} />
							<AlphaSlider
								value={hsla.a}
								hue={hsla.h}
								saturation={hsla.s}
								lightness={hsla.l}
								onChange={(a) => update({ ...hsla, a })}
							/>
						</div>
					</div>

					{/* Format + value inputs */}
					<FormatInputs
						hsla={hsla}
						format={format}
						onFormatChange={setFormat}
						onHslaChange={update}
					/>
				</div>
			</PopoverContent>
		</Popover>
	)
}
