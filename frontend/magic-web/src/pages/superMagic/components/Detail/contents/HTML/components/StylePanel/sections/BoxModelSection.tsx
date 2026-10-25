import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { DimensionInput, NumericDragInput } from "../controls"
import type { StyleSectionProps } from "../types"
import { formatUsedSizeLabel, getDimensionField } from "../utils/dimensionValue"

type BoxSide = "top" | "right" | "bottom" | "left"
type BoxValues = Record<BoxSide, string>

function parseBox(value: string | undefined): BoxValues {
	const values = (value || "0px")
		.trim()
		.split(/\s+/)
		.map((item) => item.replace(/px$/i, ""))
		.filter(Boolean)

	if (values.length === 1) {
		return { top: values[0], right: values[0], bottom: values[0], left: values[0] }
	}
	if (values.length === 2) {
		return { top: values[0], right: values[1], bottom: values[0], left: values[1] }
	}
	if (values.length === 3) {
		return { top: values[0], right: values[1], bottom: values[2], left: values[1] }
	}
	if (values.length >= 4) {
		return { top: values[0], right: values[1], bottom: values[2], left: values[3] }
	}
	return { top: "0", right: "0", bottom: "0", left: "0" }
}

function formatBox(values: BoxValues) {
	return `${values.top}px ${values.right}px ${values.bottom}px ${values.left}px`
}

interface EdgeInputProps {
	label: string
	layer: "margin" | "border" | "padding"
	side: BoxSide
	value: string
	onChange: (value: string) => void
	onCommit: (value: string) => void
}

function EdgeInput({ label, layer, side, value, onChange, onCommit }: EdgeInputProps) {
	return (
		<NumericDragInput
			value={value}
			onChange={onChange}
			onCommit={onCommit}
			onBlur={() => onCommit(value)}
			inputMode="decimal"
			hideStepper
			className="h-5 w-8 rounded-none border-transparent bg-transparent px-0.5 text-center text-[11px] tabular-nums leading-none shadow-none outline-none ring-0 focus-visible:ring-0"
			aria-label={label}
			data-testid={`box-model-edge-${layer}-${side}`}
		/>
	)
}

interface BoxLayerProps {
	label: string
	values: BoxValues
	color: "margin" | "border" | "padding"
	center: React.ReactNode
	onChange?: (side: BoxSide, value: string) => void
	onCommit?: (side: BoxSide, value: string) => void
	sideLabel: (side: BoxSide) => string
}

function BoxLayer({ label, values, color, center, onChange, onCommit, sideLabel }: BoxLayerProps) {
	const palette = {
		margin: "border-border bg-muted/40",
		border: "border-border bg-background",
		padding: "border-border bg-muted/20",
	}[color]

	return (
		<div className={`group relative w-full min-w-0 rounded-none border p-1 ${palette}`}>
			{color === "margin" ? (
				<>
					<span className="pointer-events-none absolute -left-px -top-px h-2 w-2 border-l-[1.5px] border-t-[1.5px] border-foreground/55" />
					<span className="pointer-events-none absolute -right-px -top-px h-2 w-2 border-r-[1.5px] border-t-[1.5px] border-foreground/55" />
					<span className="pointer-events-none absolute -bottom-px -left-px h-2 w-2 border-b-[1.5px] border-l-[1.5px] border-foreground/55" />
					<span className="pointer-events-none absolute -bottom-px -right-px h-2 w-2 border-b-[1.5px] border-r-[1.5px] border-foreground/55" />
				</>
			) : null}
			<div className="pointer-events-none absolute left-1 top-0.5 max-w-[calc(100%-3rem)] truncate text-[10px] font-medium text-muted-foreground">
				{label}
			</div>
			<div className="grid w-full min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] grid-rows-[1.25rem_minmax(2rem,auto)_1.25rem]">
				{onChange && (
					<>
						<div className="col-start-2 row-start-1 flex items-center justify-center overflow-hidden">
							<EdgeInput
								label={sideLabel("top")}
								layer={color}
								side="top"
								value={values.top}
								onChange={(value) => onChange("top", value)}
								onCommit={(value) => onCommit?.("top", value)}
							/>
						</div>
						<div className="col-start-1 row-start-2 flex items-center justify-center overflow-hidden">
							<EdgeInput
								label={sideLabel("left")}
								layer={color}
								side="left"
								value={values.left}
								onChange={(value) => onChange("left", value)}
								onCommit={(value) => onCommit?.("left", value)}
							/>
						</div>
						<div className="col-start-3 row-start-2 flex items-center justify-center overflow-hidden">
							<EdgeInput
								label={sideLabel("right")}
								layer={color}
								side="right"
								value={values.right}
								onChange={(value) => onChange("right", value)}
								onCommit={(value) => onCommit?.("right", value)}
							/>
						</div>
						<div className="col-start-2 row-start-3 flex items-center justify-center overflow-hidden">
							<EdgeInput
								label={sideLabel("bottom")}
								layer={color}
								side="bottom"
								value={values.bottom}
								onChange={(value) => onChange("bottom", value)}
								onCommit={(value) => onCommit?.("bottom", value)}
							/>
						</div>
					</>
				)}
				<div className="col-start-2 row-start-2 flex min-h-0 w-full min-w-0 items-center justify-center">
					{center}
				</div>
			</div>
		</div>
	)
}

type BoxProperty = "margin" | "padding" | "borderWidth"

const BoxModelSection = observer(function BoxModelSection({
	selectedElement,
	editorRef,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles
	const [margin, setMargin] = useState(() => parseBox(computedStyles?.margin))
	const [border, setBorder] = useState(() => parseBox(computedStyles?.borderWidth))
	const [padding, setPadding] = useState(() => parseBox(computedStyles?.padding))
	const previewSessionRef = useRef<{
		property: BoxProperty
		selector: string
		generation: number
	} | null>(null)
	const previewBatchRef = useRef<{
		property: BoxProperty
		selector: string
		generation: number
	} | null>(null)
	const previewPromiseRef = useRef<Promise<void> | null>(null)
	const previewGenerationRef = useRef(0)
	const lastCommitRef = useRef<{
		property: BoxProperty
		selector?: string
		value: string
	} | null>(null)
	const commitPromiseRef = useRef<Promise<void> | null>(null)

	useEffect(() => {
		setMargin(parseBox(computedStyles?.margin))
		setBorder(parseBox(computedStyles?.borderWidth))
		setPadding(parseBox(computedStyles?.padding))
	}, [
		computedStyles?.borderWidth,
		computedStyles?.margin,
		computedStyles?.padding,
		selectedElement?.selector,
	])

	const cancelPreviewBatch = useCallback(async () => {
		if (!previewBatchRef.current) {
			previewSessionRef.current = null
			return
		}
		previewBatchRef.current = null
		previewSessionRef.current = null
		const editor = editorRef?.current
		if (!editor) return
		try {
			await editor.cancelBatchOperation()
		} catch (error) {
			console.error("[BoxModelSection] Failed to cancel preview:", error)
		}
	}, [editorRef])

	useEffect(() => {
		previewGenerationRef.current += 1
		previewSessionRef.current = null
		lastCommitRef.current = null
		void cancelPreviewBatch()

		return () => {
			previewGenerationRef.current += 1
			previewSessionRef.current = null
			void cancelPreviewBatch()
		}
	}, [cancelPreviewBatch, selectedElement?.selector])

	const previewBox = useCallback(
		(property: BoxProperty, previous: BoxValues, next: BoxValues) => {
			const selector = selectedElement?.selector
			const editor = editorRef?.current
			if (!selector || !editor) return
			const generation = previewGenerationRef.current
			const styles = { [property]: formatBox(next) }
			const runPreview = async () => {
				let ownsBatch = false
				try {
					const currentSession = previewSessionRef.current
					if (
						currentSession?.property !== property ||
						currentSession.selector !== selector ||
						currentSession.generation !== generation
					) {
						if (previewBatchRef.current) await cancelPreviewBatch()
						if (generation !== previewGenerationRef.current) return
						await editor.beginBatchOperation(selector, {
							[property]: formatBox(previous),
						})
						previewBatchRef.current = { property, selector, generation }
						ownsBatch = true
					}
					if (generation !== previewGenerationRef.current) {
						if (ownsBatch) await cancelPreviewBatch()
						return
					}
					await editor.applyStylesTemporary(selector, styles)
					if (generation !== previewGenerationRef.current) {
						if (ownsBatch) await cancelPreviewBatch()
						return
					}
					previewSessionRef.current = { property, selector, generation }
				} catch (error) {
					console.error("[BoxModelSection] Preview failed:", error)
					if (
						previewBatchRef.current?.property === property &&
						previewBatchRef.current.selector === selector &&
						previewBatchRef.current.generation === generation
					) {
						await cancelPreviewBatch()
					}
					if (previewSessionRef.current?.property === property) {
						previewSessionRef.current = null
					}
				}
			}
			const previousPromise = previewPromiseRef.current ?? Promise.resolve()
			const promise = previousPromise.then(runPreview, runPreview)
			previewPromiseRef.current = promise
			void promise.finally(() => {
				if (previewPromiseRef.current === promise) previewPromiseRef.current = null
			})
		},
		[cancelPreviewBatch, editorRef, selectedElement?.selector],
	)

	const commitBox = useCallback(
		async (property: BoxProperty, values: BoxValues) => {
			const styles = { [property]: formatBox(values) }
			const selector = selectedElement?.selector
			const runCommit = async () => {
				await previewPromiseRef.current?.catch(() => undefined)
				const value = styles[property]
				const lastCommit = lastCommitRef.current
				if (
					lastCommit?.property === property &&
					lastCommit.selector === selector &&
					lastCommit.value === value
				) {
					return
				}

				const session = previewSessionRef.current
				const editor = editorRef?.current
				if (session?.property === property && session.selector === selector && editor) {
					try {
						await editor.endBatchOperation(selector, styles)
						previewSessionRef.current = null
						previewBatchRef.current = null
					} catch (error) {
						console.error("[BoxModelSection] Commit failed:", error)
						await cancelPreviewBatch()
						onStyleChange?.(property, value)
						lastCommitRef.current = { property, selector, value }
						return
					}
					try {
						await editor.refreshSelectedElement(selector)
					} catch (error) {
						console.error("[BoxModelSection] Refresh after commit failed:", error)
					}
					lastCommitRef.current = { property, selector, value }
					return
				}

				// Preview is optional; persist the value when it was not established.
				onStyleChange?.(property, value)
				lastCommitRef.current = { property, selector, value }
			}
			const previousPromise = commitPromiseRef.current ?? Promise.resolve()
			const promise = previousPromise.then(runCommit, runCommit)
			commitPromiseRef.current = promise
			try {
				await promise
			} finally {
				if (commitPromiseRef.current === promise) commitPromiseRef.current = null
			}
		},
		[cancelPreviewBatch, editorRef, onStyleChange, selectedElement?.selector],
	)

	const updateBox = useCallback(
		(property: BoxProperty, side: BoxSide, value: string) => {
			if (value !== "" && !/^-?\d*(?:\.\d*)?$/.test(value)) return
			lastCommitRef.current = null
			if (
				property === "borderWidth" &&
				Number.parseFloat(value) > 0 &&
				(computedStyles?.borderStyle || "none") === "none"
			) {
				onStyleChange?.("borderStyle", "solid")
			}
			const setter =
				property === "margin" ? setMargin : property === "padding" ? setPadding : setBorder
			setter((previous) => {
				const next = { ...previous, [side]: value || "0" }
				previewBox(property, previous, next)
				return next
			})
		},
		[computedStyles?.borderStyle, onStyleChange, previewBox],
	)

	const finishBox = useCallback(
		(property: BoxProperty, side: BoxSide, value: string) => {
			if (value !== "" && !/^-?\d*(?:\.\d*)?$/.test(value)) return
			const current =
				property === "margin" ? margin : property === "padding" ? padding : border
			void commitBox(property, { ...current, [side]: value || "0" })
		},
		[border, commitBox, margin, padding],
	)

	const width = getDimensionField(selectedElement, "width")
	const height = getDimensionField(selectedElement, "height")
	const borderWidth = computedStyles?.borderWidth || "0px"
	const usedWidth = formatUsedSizeLabel(computedStyles?.width)
	const usedHeight = formatUsedSizeLabel(computedStyles?.height)
	const dimensions = `${usedWidth} × ${usedHeight}`
	const getSideLabel = useCallback(
		(layer: string, side: BoxSide) =>
			t("stylePanel.boxModelSideLabel", {
				layer,
				side: t(`stylePanel.boxModelSide.${side}`),
			}),
		[t],
	)
	const marginLabel = t("stylePanel.margin")
	const borderLabel = t("stylePanel.border")
	const paddingLabel = t("stylePanel.padding")

	return (
		<div className="min-w-0 space-y-2" data-testid="html-style-panel-box-model">
			<div className="grid min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
				<DimensionInput
					key={`${selectedElement?.selector ?? "none"}-width`}
					label={t("stylePanel.width")}
					value={width.value}
					onChange={(value) => onStyleChange?.("width", value)}
					placeholder="auto"
					id="html-style-panel-box-width"
					compact
					pixelValue={computedStyles?.width}
					valueFromInline={width.fromInline}
				/>
				<DimensionInput
					key={`${selectedElement?.selector ?? "none"}-height`}
					label={t("stylePanel.height")}
					value={height.value}
					onChange={(value) => onStyleChange?.("height", value)}
					placeholder="auto"
					id="html-style-panel-box-height"
					compact
					pixelValue={computedStyles?.height}
					valueFromInline={height.fromInline}
				/>
			</div>

			<BoxLayer
				label={marginLabel}
				values={margin}
				color="margin"
				sideLabel={(side) => getSideLabel(marginLabel, side)}
				onChange={(side, value) => updateBox("margin", side, value)}
				onCommit={(side, value) => finishBox("margin", side, value)}
				center={
					<BoxLayer
						label={t("stylePanel.boxModelLayer", {
							label: borderLabel,
							value: borderWidth,
						})}
						values={border}
						color="border"
						sideLabel={(side) => getSideLabel(borderLabel, side)}
						onChange={(side, value) => updateBox("borderWidth", side, value)}
						onCommit={(side, value) => finishBox("borderWidth", side, value)}
						center={
							<BoxLayer
								label={paddingLabel}
								values={padding}
								color="padding"
								sideLabel={(side) => getSideLabel(paddingLabel, side)}
								onChange={(side, value) => updateBox("padding", side, value)}
								onCommit={(side, value) => finishBox("padding", side, value)}
								center={
									<div
										className="flex min-h-8 w-full min-w-0 items-center justify-center border border-dashed border-border bg-background px-1 py-1 text-center text-[11px] tabular-nums leading-tight text-foreground"
										data-testid="html-style-panel-box-model-content"
									>
										<span className="flex min-w-0 flex-wrap items-center justify-center gap-x-1">
											{dimensions ? (
												<>
													<span>{usedWidth}</span>
													<span>×</span>
													<span>{usedHeight}</span>
												</>
											) : (
												t("stylePanel.boxModelContent")
											)}
										</span>
									</div>
								}
							/>
						}
					/>
				}
			/>
		</div>
	)
})

export default BoxModelSection
