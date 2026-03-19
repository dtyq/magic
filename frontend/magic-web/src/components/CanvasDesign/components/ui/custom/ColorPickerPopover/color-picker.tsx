"use client"

import Color from "color"
import { PipetteIcon } from "lucide-react"
import { Slider } from "radix-ui"
import {
	type ComponentProps,
	createContext,
	type HTMLAttributes,
	memo,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { Button } from "../../button"
import { Input } from "../../input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../select"
import { cn } from "../../../../lib/utils"

interface ColorPickerContextValue {
	hue: number
	saturation: number
	lightness: number
	alpha: number
	mode: string
	setHue: (hue: number) => void
	setSaturation: (saturation: number) => void
	setLightness: (lightness: number) => void
	setAlpha: (alpha: number) => void
	setMode: (mode: string) => void
}

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(undefined)

export const useColorPicker = () => {
	const context = useContext(ColorPickerContext)

	if (!context) {
		throw new Error("useColorPicker must be used within a ColorPickerProvider")
	}

	return context
}

export type ColorPickerProps = HTMLAttributes<HTMLDivElement> & {
	value?: Parameters<typeof Color>[0]
	defaultValue?: Parameters<typeof Color>[0]
	onChange?: (value: Parameters<typeof Color.rgb>[0]) => void
	mode?: "hex" | "rgb" | "hsl"
	onModeChange?: (mode: "hex" | "rgb" | "hsl") => void
}

export const ColorPicker = ({
	value,
	defaultValue = "#000000",
	onChange,
	mode: controlledMode,
	onModeChange,
	className,
	...props
}: ColorPickerProps) => {
	const selectedColor = Color(value)
	const defaultColor = Color(defaultValue)

	const [hue, setHue] = useState(selectedColor.hue() || defaultColor.hue() || 0)
	const [saturation, setSaturation] = useState(
		selectedColor.saturationl() || defaultColor.saturationl() || 100,
	)
	const [lightness, setLightness] = useState(
		selectedColor.lightness() || defaultColor.lightness() || 50,
	)
	const [alpha, setAlpha] = useState(selectedColor.alpha() * 100 || defaultColor.alpha() * 100)
	const [internalMode, setInternalMode] = useState<"hex" | "rgb" | "hsl">(controlledMode || "rgb")

	// 使用受控模式或内部模式
	const mode = controlledMode || internalMode

	// 包装 setMode 以支持受控模式
	const handleSetMode = useCallback(
		(newMode: string) => {
			const typedMode = newMode as "hex" | "rgb" | "hsl"
			if (!controlledMode) {
				setInternalMode(typedMode)
			}
			onModeChange?.(typedMode)
		},
		[controlledMode, onModeChange],
	)

	// Track if we're syncing from external value to prevent triggering onChange
	const isSyncingRef = useRef(false)

	// Update color when controlled value changes
	useEffect(() => {
		if (value) {
			const color = Color(value)
			const [h, s, l] = color.hsl().array()
			const a = color.alpha()

			isSyncingRef.current = true
			setHue(h || 0)
			setSaturation(s || 0)
			setLightness(l || 0)
			setAlpha((a ?? 1) * 100)
			// Reset sync flag after state updates are applied
			setTimeout(() => {
				isSyncingRef.current = false
			}, 0)
		}
	}, [value])

	// Notify parent of changes
	const onChangeRef = useRef(onChange)
	onChangeRef.current = onChange

	useEffect(() => {
		// Don't trigger onChange if we're syncing from external value
		if (onChangeRef.current && !isSyncingRef.current) {
			const color = Color.hsl(hue, saturation, lightness).alpha(alpha / 100)
			const rgba = color.rgb().array()

			onChangeRef.current([
				Math.round(rgba[0]),
				Math.round(rgba[1]),
				Math.round(rgba[2]),
				alpha / 100,
			])
		}
	}, [hue, saturation, lightness, alpha])

	return (
		<ColorPickerContext.Provider
			value={{
				hue,
				saturation,
				lightness,
				alpha,
				mode,
				setHue,
				setSaturation,
				setLightness,
				setAlpha,
				setMode: handleSetMode,
			}}
		>
			<div className={cn("flex size-full flex-col gap-4", className)} {...(props as any)} />
		</ColorPickerContext.Provider>
	)
}

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>

export const ColorPickerSelection = memo(({ className, ...props }: ColorPickerSelectionProps) => {
	const containerRef = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [positionX, setPositionX] = useState(0)
	const [positionY, setPositionY] = useState(0)
	const { hue, saturation, lightness, setSaturation, setLightness } = useColorPicker()

	const backgroundGradient = useMemo(() => {
		return `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)),
            linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)),
            hsl(${hue}, 100%, 50%)`
	}, [hue])

	// 根据 saturation 和 lightness 计算位置
	useEffect(() => {
		if (!isDragging) {
			// 从 saturation 计算 x
			const x = saturation / 100

			// 从 lightness 计算 y (反向计算)
			// lightness = topLightness * (1 - y)
			// topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x)
			const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x)
			const y = topLightness > 0 ? 1 - lightness / topLightness : 0

			setPositionX(Math.max(0, Math.min(1, x)))
			setPositionY(Math.max(0, Math.min(1, y)))
		}
	}, [saturation, lightness, isDragging])

	const handlePointerMove = useCallback(
		(event: PointerEvent) => {
			if (!(isDragging && containerRef.current)) {
				return
			}
			const rect = containerRef.current.getBoundingClientRect()
			const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
			const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
			setPositionX(x)
			setPositionY(y)
			setSaturation(x * 100)
			const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x)
			const lightness = topLightness * (1 - y)

			setLightness(lightness)
		},
		[isDragging, setSaturation, setLightness],
	)

	useEffect(() => {
		const handlePointerUp = () => setIsDragging(false)

		if (isDragging) {
			window.addEventListener("pointermove", handlePointerMove)
			window.addEventListener("pointerup", handlePointerUp)
		}

		return () => {
			window.removeEventListener("pointermove", handlePointerMove)
			window.removeEventListener("pointerup", handlePointerUp)
		}
	}, [isDragging, handlePointerMove])

	return (
		<div
			className={cn("relative size-full cursor-crosshair rounded", className)}
			onPointerDown={(e) => {
				e.preventDefault()
				setIsDragging(true)
				handlePointerMove(e.nativeEvent)
			}}
			ref={containerRef}
			style={{
				background: backgroundGradient,
			}}
			{...(props as any)}
		>
			<div
				className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
				style={{
					left: `${positionX * 100}%`,
					top: `${positionY * 100}%`,
					boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
				}}
			/>
		</div>
	)
})

ColorPickerSelection.displayName = "ColorPickerSelection"

export type ColorPickerHueProps = ComponentProps<typeof Slider.Root>

export const ColorPickerHue = ({ className, ...props }: ColorPickerHueProps) => {
	const { hue, setHue } = useColorPicker()

	return (
		<Slider.Root
			className={cn("relative flex h-4 w-full touch-none", className)}
			max={360}
			onValueChange={([hue]) => setHue(hue)}
			step={1}
			value={[hue]}
			{...(props as any)}
		>
			<Slider.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
				<Slider.Range className="absolute h-full" />
			</Slider.Track>
			<Slider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
		</Slider.Root>
	)
}

export type ColorPickerAlphaProps = ComponentProps<typeof Slider.Root>

export const ColorPickerAlpha = ({ className, ...props }: ColorPickerAlphaProps) => {
	const { alpha, setAlpha } = useColorPicker()

	return (
		<Slider.Root
			className={cn("relative flex h-4 w-full touch-none", className)}
			max={100}
			onValueChange={([alpha]) => setAlpha(alpha)}
			step={1}
			value={[alpha]}
			{...(props as any)}
		>
			<Slider.Track
				className="relative my-0.5 h-3 w-full grow rounded-full"
				style={{
					background:
						'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==") left center',
				}}
			>
				<div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent to-black/50" />
				<Slider.Range className="absolute h-full rounded-full bg-transparent" />
			</Slider.Track>
			<Slider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
		</Slider.Root>
	)
}

export type ColorPickerEyeDropperProps = ComponentProps<typeof Button>

export const ColorPickerEyeDropper = ({ className, ...props }: ColorPickerEyeDropperProps) => {
	const { setHue, setSaturation, setLightness, setAlpha } = useColorPicker()

	const handleEyeDropper = async () => {
		try {
			// @ts-expect-error - EyeDropper API is experimental
			const eyeDropper = new EyeDropper()
			const result = await eyeDropper.open()
			const color = Color(result.sRGBHex)
			const [h, s, l] = color.hsl().array()

			setHue(h)
			setSaturation(s)
			setLightness(l)
			setAlpha(100)
		} catch (error) {
			console.error("EyeDropper failed:", error)
		}
	}

	return (
		<Button
			className={cn("shrink-0 text-muted-foreground", className)}
			onClick={handleEyeDropper}
			size="icon"
			variant="outline"
			type="button"
			{...(props as any)}
		>
			<PipetteIcon size={16} />
		</Button>
	)
}

export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>

const formats = ["rgb", "hex", "hsl"]

export const ColorPickerOutput = ({ className, ...props }: ColorPickerOutputProps) => {
	const { mode, setMode } = useColorPicker()

	return (
		<Select onValueChange={setMode} value={mode}>
			<SelectTrigger className="h-8 w-20 shrink-0 text-xs" {...(props as any)}>
				<SelectValue placeholder="Mode" />
			</SelectTrigger>
			<SelectContent>
				{formats.map((format) => (
					<SelectItem className="text-xs" key={format} value={format}>
						{format.toUpperCase()}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

type PercentageInputProps = ComponentProps<typeof Input> & {
	onValueChange?: (value: number) => void
}

const PercentageInput = ({ className, value, onValueChange, ...props }: PercentageInputProps) => {
	const [localValue, setLocalValue] = useState(String(value ?? ""))

	useEffect(() => {
		setLocalValue(String(value ?? ""))
	}, [value])

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value
		setLocalValue(newValue)
	}

	const handleBlur = () => {
		const numValue = Number.parseFloat(localValue)
		if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 100) {
			onValueChange?.(Math.round(numValue))
		} else {
			// 恢复原值
			setLocalValue(String(value ?? ""))
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.currentTarget.blur()
		}
	}

	return (
		<div className="relative">
			<Input
				type="text"
				value={localValue}
				onChange={handleChange}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				{...(props as any)}
				className={cn(
					"h-8 w-[3.25rem] rounded-l-none bg-secondary px-2 text-xs shadow-none focus-visible:outline-none focus-visible:ring-0",
					className,
				)}
			/>
			<span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
				%
			</span>
		</div>
	)
}

export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>

export const ColorPickerFormat = ({ className, ...props }: ColorPickerFormatProps) => {
	const {
		hue,
		saturation,
		lightness,
		alpha,
		mode,
		setHue,
		setSaturation,
		setLightness,
		setAlpha,
	} = useColorPicker()
	const color = Color.hsl(hue, saturation, lightness, alpha / 100)
	const roundedAlpha = Math.round(alpha ?? 100)

	const rgb = color
		.rgb()
		.array()
		.map((value) => Math.round(value))
	const hsl = color
		.hsl()
		.array()
		.map((value) => Math.round(value))

	// 所有 useState 必须在顶层调用
	const [hexInput, setHexInput] = useState("")
	const [rgbInputs, setRgbInputs] = useState(rgb.map(String))
	const [hslInputs, setHslInputs] = useState(hsl.map(String))

	// 同步 hex 输入
	useEffect(() => {
		setHexInput(color.hex())
	}, [hue, saturation, lightness])

	// 同步 rgb 输入
	useEffect(() => {
		setRgbInputs(rgb.map(String))
	}, [rgb.join(",")])

	// 同步 hsl 输入
	useEffect(() => {
		setHslInputs(hsl.map(String))
	}, [hsl.join(",")])

	const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setHexInput(e.target.value)
	}

	const handleHexBlur = () => {
		try {
			const parsedColor = Color(hexInput)
			const [h, s, l] = parsedColor.hsl().array()
			const a = parsedColor.alpha()
			setHue(h || 0)
			setSaturation(s || 0)
			setLightness(l || 0)
			setAlpha((a ?? 1) * 100)
		} catch {
			// 恢复原值
			setHexInput(color.hex())
		}
	}

	const handleRgbChange = (index: number, value: string) => {
		const newInputs = [...rgbInputs]
		newInputs[index] = value
		setRgbInputs(newInputs)
	}

	const handleRgbBlur = (index: number) => {
		const numValue = Number.parseInt(rgbInputs[index], 10)
		if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 255) {
			const newRgb = [...rgb]
			newRgb[index] = numValue
			try {
				const parsedColor = Color.rgb(newRgb)
				const [h, s, l] = parsedColor.hsl().array()
				const a = parsedColor.alpha()
				setHue(h || 0)
				setSaturation(s || 0)
				setLightness(l || 0)
				setAlpha((a ?? 1) * 100)
			} catch {
				// 恢复原值
				setRgbInputs(rgb.map(String))
			}
		} else {
			// 恢复原值
			setRgbInputs(rgb.map(String))
		}
	}

	const handleHslChange = (index: number, value: string) => {
		const newInputs = [...hslInputs]
		newInputs[index] = value
		setHslInputs(newInputs)
	}

	const handleHslBlur = (index: number) => {
		const numValue = Number.parseFloat(hslInputs[index])
		// H: 0-360, S: 0-100, L: 0-100
		const maxValues = [360, 100, 100]
		if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= maxValues[index]) {
			const newHsl = [...hsl]
			newHsl[index] = Math.round(numValue)
			try {
				if (index === 0) setHue(newHsl[0])
				if (index === 1) setSaturation(newHsl[1])
				if (index === 2) setLightness(newHsl[2])
			} catch {
				// 恢复原值
				setHslInputs(hsl.map(String))
			}
		} else {
			// 恢复原值
			setHslInputs(hsl.map(String))
		}
	}

	const handleAlphaChange = (value: number) => {
		setAlpha(value)
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.currentTarget.blur()
		}
	}

	if (mode === "hex") {
		return (
			<div
				className={cn(
					"relative flex w-full items-center -space-x-px rounded-md shadow-sm",
					className,
				)}
				{...(props as any)}
			>
				<Input
					className="h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none focus-visible:outline-none focus-visible:ring-0"
					type="text"
					value={hexInput}
					onChange={handleHexChange}
					onBlur={handleHexBlur}
					onKeyDown={handleKeyDown}
				/>
				<PercentageInput value={roundedAlpha} onValueChange={handleAlphaChange} />
			</div>
		)
	}

	if (mode === "rgb") {
		return (
			<div
				className={cn("flex items-center -space-x-px rounded-md shadow-sm", className)}
				{...(props as any)}
			>
				{rgb.map((value, index) => (
					<Input
						className={cn(
							"h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none focus-visible:outline-none focus-visible:ring-0",
							index && "rounded-l-none",
							className,
						)}
						key={index}
						type="text"
						value={rgbInputs[index]}
						onChange={(e) => handleRgbChange(index, e.target.value)}
						onBlur={() => handleRgbBlur(index)}
						onKeyDown={handleKeyDown}
					/>
				))}
				<PercentageInput value={roundedAlpha} onValueChange={handleAlphaChange} />
			</div>
		)
	}

	if (mode === "hsl") {
		return (
			<div
				className={cn("flex items-center -space-x-px rounded-md shadow-sm", className)}
				{...(props as any)}
			>
				{hsl.map((value, index) => (
					<Input
						className={cn(
							"h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none focus-visible:outline-none focus-visible:ring-0",
							index && "rounded-l-none",
							className,
						)}
						key={index}
						type="text"
						value={hslInputs[index]}
						onChange={(e) => handleHslChange(index, e.target.value)}
						onBlur={() => handleHslBlur(index)}
						onKeyDown={handleKeyDown}
					/>
				))}
				<PercentageInput value={roundedAlpha} onValueChange={handleAlphaChange} />
			</div>
		)
	}

	return null
}
