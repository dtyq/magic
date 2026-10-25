import { useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

/** Pointer capture keeps resizing in the companion document, even over slide iframes. */
export function PresenterSplit({
	vertical = false,
	initial = 60,
	label,
	first,
	second,
}: {
	vertical?: boolean
	initial?: number
	label: string
	first: ReactNode
	second: ReactNode
}) {
	const root = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState(initial)
	const [dragging, setDragging] = useState(false)
	const clamp = (value: number) => Math.max(20, Math.min(80, value))
	return (
		<div
			ref={root}
			className="relative grid h-full min-h-0 min-w-0"
			style={
				vertical
					? { gridTemplateRows: `minmax(0, ${size}fr) 12px minmax(0, ${100 - size}fr)` }
					: {
							gridTemplateColumns: `minmax(0, ${size}fr) 12px minmax(0, ${100 - size}fr)`,
						}
			}
		>
			<div className="min-h-0 min-w-0 overflow-hidden">{first}</div>
			<div
				role="separator"
				tabIndex={0}
				aria-label={label}
				aria-orientation={vertical ? "horizontal" : "vertical"}
				aria-valuemin={20}
				aria-valuemax={80}
				aria-valuenow={Math.round(size)}
				className={`z-20 flex touch-none items-center justify-center rounded hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${vertical ? "cursor-row-resize" : "cursor-col-resize"}`}
				onPointerDown={(event) => {
					if (event.button !== 0) return
					event.preventDefault()
					event.currentTarget.setPointerCapture(event.pointerId)
					setDragging(true)
				}}
				onPointerMove={(event) => {
					if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
					const bounds = root.current?.getBoundingClientRect()
					if (!bounds) return
					const extent = (vertical ? bounds.height : bounds.width) - 12
					if (extent <= 0) return
					setSize(
						clamp(
							(((vertical
								? event.clientY - bounds.top
								: event.clientX - bounds.left) -
								6) /
								extent) *
								100,
						),
					)
				}}
				onPointerUp={(event) => {
					if (event.currentTarget.hasPointerCapture(event.pointerId))
						event.currentTarget.releasePointerCapture(event.pointerId)
					setDragging(false)
				}}
				onLostPointerCapture={() => setDragging(false)}
				onPointerCancel={() => setDragging(false)}
				onKeyDown={(event) => {
					const previous = vertical ? "ArrowUp" : "ArrowLeft"
					const next = vertical ? "ArrowDown" : "ArrowRight"
					if (![previous, next, "Home", "End"].includes(event.key)) return
					event.preventDefault()
					event.stopPropagation()
					setSize((value) =>
						event.key === "Home"
							? 20
							: event.key === "End"
								? 80
								: clamp(value + (event.key === next ? 2 : -2)),
					)
				}}
			>
				<span className={`rounded-full bg-white/35 ${vertical ? "h-1 w-8" : "h-8 w-1"}`} />
			</div>
			<div className="min-h-0 min-w-0 overflow-hidden">{second}</div>
			{/* Stop embedded documents from stealing pointer events during the drag. */}
			{dragging && (
				<div
					className={`absolute inset-0 z-10 ${vertical ? "cursor-row-resize" : "cursor-col-resize"}`}
				/>
			)}
		</div>
	)
}

export default function PPTPresenterLayout({
	current,
	next,
	notes,
	filmstrip,
	controls,
}: {
	current: ReactNode
	next: ReactNode
	notes: ReactNode
	filmstrip: ReactNode
	controls: ReactNode
}) {
	const { t } = useTranslation("super")
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
			<div className="min-h-0 flex-1">
				<PresenterSplit
					label={t("ppt.presenter.resizeColumns")}
					first={
						<PresenterSplit
							vertical
							initial={80}
							label={t("ppt.presenter.resizeFilmstrip")}
							first={current}
							second={filmstrip}
						/>
					}
					second={
						<PresenterSplit
							vertical
							initial={50}
							label={t("ppt.presenter.resizeNotes")}
							first={next}
							second={notes}
						/>
					}
				/>
			</div>
			{controls}
		</div>
	)
}
