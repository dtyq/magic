import { useLayoutEffect, useRef, type ReactNode } from "react"
import { Table } from "@magic-admin-v2/components/ui/table"
import { cn } from "@magic-admin-v2/utils/cn"

/** Splits the horizontal viewports so the browser can pin the header to the page. */
export function DataTableFrame({
	children,
	containerClassName,
	containerTestId,
	header,
	minWidth,
	sizingHeader,
	stickyHeader,
	tableClassName,
}: {
	children: ReactNode
	containerClassName?: string
	containerTestId?: string
	header: ReactNode
	minWidth: number
	sizingHeader: ReactNode
	stickyHeader: boolean
	tableClassName: string
}) {
	const bodyTableRef = useRef<HTMLTableElement>(null)
	const headerTableRef = useRef<HTMLTableElement>(null)
	const headerViewportRef = useRef<HTMLDivElement>(null)

	useLayoutEffect(() => {
		const bodyTable = bodyTableRef.current
		const headerTable = headerTableRef.current
		const headerViewport = headerViewportRef.current
		const bodyViewport = bodyTable?.parentElement
		if (!stickyHeader || !bodyTable || !headerTable || !headerViewport || !bodyViewport) return

		function syncFromBody() {
			if (headerViewport && bodyViewport) headerViewport.scrollLeft = bodyViewport.scrollLeft
		}
		function syncFromHeader() {
			if (headerViewport && bodyViewport) bodyViewport.scrollLeft = headerViewport.scrollLeft
		}
		function measureColumns() {
			if (!bodyTable || !headerTable) return
			const sourceCells = bodyTable.tHead?.querySelectorAll("th")
			headerTable.style.width = `${bodyTable.getBoundingClientRect().width}px`
			headerTable.querySelectorAll("th").forEach((cell, index) => {
				const source = sourceCells?.[index]
				if (source) cell.style.width = `${source.getBoundingClientRect().width}px`
			})
			syncFromBody()
		}
		function scrollHeader(event: WheelEvent) {
			const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0)
			if (!delta || !bodyViewport) return
			event.preventDefault()
			bodyViewport.scrollLeft +=
				delta *
				(event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bodyViewport.clientWidth : 1)
			syncFromBody()
		}

		// Only horizontal movement is synchronized. Vertical pinning stays entirely
		// native, so fast page scrolling never waits for JavaScript or an animation frame.
		const observer = new ResizeObserver(measureColumns)
		observer.observe(bodyTable)
		bodyTable.tHead?.querySelectorAll("th").forEach((cell) => observer.observe(cell))
		bodyViewport.addEventListener("scroll", syncFromBody, { passive: true })
		headerViewport.addEventListener("scroll", syncFromHeader, { passive: true })
		headerViewport.addEventListener("wheel", scrollHeader, { passive: false })
		measureColumns()
		return () => {
			observer.disconnect()
			bodyViewport.removeEventListener("scroll", syncFromBody)
			headerViewport.removeEventListener("scroll", syncFromHeader)
			headerViewport.removeEventListener("wheel", scrollHeader)
		}
	}, [stickyHeader, header, children])

	return (
		<div
			className={cn(
				"rounded-lg border border-border/50 bg-card",
				stickyHeader ? "relative isolate" : "overflow-hidden",
				containerClassName,
			)}
			data-slot="data-table-desktop"
			data-testid={containerTestId}
			role={stickyHeader ? "table" : undefined}
		>
			{stickyHeader ? (
				<div
					className="sticky top-0 z-40 overflow-hidden rounded-t-lg bg-muted shadow-sm"
					data-slot="data-table-sticky-header"
					ref={headerViewportRef}
				>
					<table className="table-fixed text-sm" ref={headerTableRef} role="presentation">
						{header}
					</table>
				</div>
			) : null}
			<div className={stickyHeader ? "overflow-hidden rounded-b-lg" : undefined}>
				<Table
					className={tableClassName}
					ref={bodyTableRef}
					role={stickyHeader ? "presentation" : undefined}
					style={{ minWidth }}
				>
					{stickyHeader ? sizingHeader : header}
					{children}
				</Table>
			</div>
		</div>
	)
}
