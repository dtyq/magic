import { useCallback, useEffect, useMemo, useState } from "react"
import IconButton from "../ui/custom/IconButton"
import { useCanvas } from "../../context/CanvasContext"
import { useCanvasEvent } from "../../hooks/useCanvasEvent"
import { Minus, Plus } from "../ui/icons/index"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from "../ui/select"
import { Divider, type ShortcutDisplay } from "../../types"
import styles from "./index.module.css"
import { formatShortcut, getShortcutDisplay } from "../../lib/index"
import { useCanvasDesignI18n } from "../../context/I18nContext"

type ZoomOption = {
	value: string
	label: string
	shortcut?: ShortcutDisplay | null
	onSelect: () => void
}

export default function Zoom() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()

	const [displayZoom, setDisplayZoom] = useState(100)

	// 订阅缩放事件，更新显示值
	useCanvasEvent("viewport:scale", ({ data }) => {
		setDisplayZoom(Math.round(data.scale * 100))
	})

	// 当 canvas 初始化时，同步当前的 scale 值
	// 解决刷新页面时，loadViewport 触发的事件在订阅之前就已经触发的问题
	useEffect(() => {
		if (!canvas) return
		const currentScale = canvas.viewportController.getScale()
		setDisplayZoom(Math.round(currentScale * 100))
	}, [canvas])

	const handleZoomIn = useCallback(() => {
		if (!canvas) return
		canvas.userActionRegistry.execute("view.zoom-in")
	}, [canvas])

	const handleZoomOut = useCallback(() => {
		if (!canvas) return
		canvas.userActionRegistry.execute("view.zoom-out")
	}, [canvas])

	const handleZoomToFit = useCallback(() => {
		if (!canvas) return
		canvas.userActionRegistry.execute("view.zoom-fit")
	}, [canvas])

	const handleZoomToScale = useCallback(
		(scale: number) => {
			if (!canvas) return
			canvas.viewportController.setScale(scale)
		},
		[canvas],
	)

	const options = useMemo<Array<ZoomOption | typeof Divider>>(() => {
		return [
			{
				value: "zoom-in",
				label: t("zoom.zoomIn", "放大"),
				shortcut: getShortcutDisplay("view.zoom-in"),
				onSelect: handleZoomIn,
			},
			{
				value: "zoom-out",
				label: t("zoom.zoomOut", "缩小"),
				shortcut: getShortcutDisplay("view.zoom-out"),
				onSelect: handleZoomOut,
			},
			{
				value: "fit",
				label: t("zoom.fitToScreen", "适配屏幕"),
				shortcut: getShortcutDisplay("view.zoom-fit"),
				onSelect: handleZoomToFit,
			},
			Divider,
			{
				value: "50",
				label: t("zoom.zoomTo", { percent: 50, defaultValue: "缩放至50%" }),
				onSelect: () => handleZoomToScale(0.5),
			},
			{
				value: "75",
				label: t("zoom.zoomTo", { percent: 75, defaultValue: "缩放至75%" }),
				onSelect: () => handleZoomToScale(0.75),
			},
			{
				value: "100",
				label: t("zoom.zoomTo", { percent: 100, defaultValue: "缩放至100%" }),
				onSelect: () => handleZoomToScale(1),
			},
			{
				value: "200",
				label: t("zoom.zoomTo", { percent: 200, defaultValue: "缩放至200%" }),
				onSelect: () => handleZoomToScale(2),
			},
		]
	}, [t, handleZoomIn, handleZoomOut, handleZoomToFit, handleZoomToScale])

	const handleValueChange = useCallback(
		(value: string) => {
			const option = options.find(
				(opt): opt is ZoomOption =>
					typeof opt === "object" && "value" in opt && opt.value === value,
			)
			if (option) {
				option.onSelect()
			}
		},
		[options],
	)

	return (
		<div className={styles.zoom} data-canvas-ui-component>
			<IconButton className={styles.zoomOut} onClick={handleZoomOut}>
				<Minus size={16} />
			</IconButton>
			<Select value="" onValueChange={handleValueChange}>
				<SelectTrigger className={styles.selectTrigger}>
					<span className={styles.zoomValue}>{displayZoom}%</span>
				</SelectTrigger>
				<SelectContent side="top" align="end" style={{ width: 200 }}>
					{options.map((option, index) => {
						if (option === Divider) {
							return <SelectSeparator key={`separator-${index}`} />
						}
						const opt = option as ZoomOption
						return (
							<SelectItem
								key={opt.value}
								value={opt.value}
								className={styles.selectItem}
							>
								<div className={styles.selectItemContent}>
									<span className={styles.label}>{opt.label}</span>
									{opt.shortcut && (
										<div className={styles.shortcut}>
											{opt.shortcut.modifiers?.map((modifier) => {
												return (
													<div key={modifier} className={styles.key}>
														{formatShortcut(modifier)}
													</div>
												)
											})}
											<div className={styles.key}>{opt.shortcut.key}</div>
										</div>
									)}
								</div>
							</SelectItem>
						)
					})}
				</SelectContent>
			</Select>
			<IconButton className={styles.zoomIn} onClick={handleZoomIn}>
				<Plus size={16} />
			</IconButton>
		</div>
	)
}
