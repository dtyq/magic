import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { getPaginationMeta } from "@magic-admin-v2/components/list-pagination/pagination-utils"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { cn } from "@magic-admin-v2/utils/cn"

const defaultPageSizeOptions = [20, 50, 100] as const

export type ListPaginationProps = {
	/** 是否允许进入下一页；传入后优先于 hasNextPage、pageCount 和 total 的计算结果。 */
	canGoNext?: boolean
	/** 是否允许返回上一页；传入后优先于根据当前页码计算的结果。 */
	canGoPrevious?: boolean
	/** 分页根容器的自定义样式。 */
	className?: string
	/** 接口是否还有下一页，适用于无法提前获得总数或总页数的分页接口。 */
	hasNextPage?: boolean
	/** 是否正在请求分页数据；加载期间禁用页容量选择和翻页按钮。 */
	loading?: boolean
	/** 自定义下一页操作；提供后下一页按钮不会调用 onPageChange。 */
	onNext?: () => void
	/** 页码变化回调，页码从 1 开始。 */
	onPageChange?: (page: number) => void
	/** 每页数量变化回调；触发后组件会同时通过 onPageChange 将页码重置为 1。 */
	onPageSizeChange?: (pageSize: number) => void
	/** 自定义上一页操作；提供后上一页按钮不会调用 onPageChange。 */
	onPrevious?: () => void
	/** 当前页码，从 1 开始。 */
	page: number
	/** 总页数；未提供时根据 total 和 pageSize 计算。 */
	pageCount?: number
	/** 当前每页数量；与 onPageSizeChange 同时提供时显示页容量选择器。 */
	pageSize?: number
	/** 可选的每页数量，默认为 20、50、100。 */
	pageSizeOptions?: readonly number[]
	/** 是否显示“当前页 / 总页数”，默认为 true。 */
	showPageIndicator?: boolean
	/** 是否显示快速跳转页码输入框；仅在已知总页数时生效，默认为 false。 */
	showQuickJumper?: boolean
	/** 是否显示总数；未提供时只要存在 total 或 totalLabelCount 就自动显示。 */
	showTotal?: boolean
	/** 数据总数，用于展示总数，并在未提供 pageCount 时计算总页数。 */
	total?: number
	/** 仅覆盖界面展示的总数，不参与总页数和翻页边界计算。 */
	totalLabelCount?: number
	/** Stable selectors for pagination controls. */
	testId?: string
	previousButtonTestId?: string
	nextButtonTestId?: string
	pageSizeTriggerTestId?: string
	pageSizeOptionTestId?: string
	jumpInputTestId?: string
}

/** 受控列表分页，统一页码、总数、每页数量和请求中禁用行为，支持游标分页和页码分页。 */
export function ListPagination({
	canGoNext,
	canGoPrevious,
	className,
	hasNextPage,
	loading = false,
	onNext,
	onPageChange,
	onPageSizeChange,
	onPrevious,
	page,
	pageCount,
	pageSize,
	pageSizeOptions = defaultPageSizeOptions,
	showPageIndicator = true,
	showQuickJumper = false,
	showTotal,
	testId,
	total,
	totalLabelCount,
	previousButtonTestId,
	nextButtonTestId,
	pageSizeTriggerTestId,
	pageSizeOptionTestId,
	jumpInputTestId,
}: ListPaginationProps) {
	const { t } = useTranslation()
	const meta = getPaginationMeta({ hasNextPage, page, pageCount, pageSize, total })
	const showPageSize = pageSize !== undefined && onPageSizeChange !== undefined
	const shouldShowTotal = showTotal ?? (total !== undefined || totalLabelCount !== undefined)
	const previousEnabled = canGoPrevious ?? meta.canGoPrevious
	const nextEnabled = canGoNext ?? meta.canGoNext
	const canQuickJump =
		showQuickJumper &&
		Boolean(onPageChange) &&
		!onNext &&
		!onPrevious &&
		(pageCount !== undefined || total !== undefined) &&
		meta.pageCount > 1
	const [jumpPage, setJumpPage] = useState(String(meta.currentPage))

	useEffect(() => {
		setJumpPage(String(meta.currentPage))
	}, [meta.currentPage])

	function commitJumpPage() {
		if (!canQuickJump || !onPageChange) return
		const parsedPage = Number(jumpPage)
		if (!jumpPage.trim() || !Number.isInteger(parsedPage)) {
			setJumpPage(String(meta.currentPage))
			return
		}
		const nextPage = Math.min(Math.max(parsedPage, 1), meta.pageCount)
		setJumpPage(String(nextPage))
		if (nextPage !== meta.currentPage) onPageChange(nextPage)
	}

	return (
		<div
			className={cn(
				"flex flex-col gap-3 border-t border-border/60 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
			data-testid={testId}
		>
			{shouldShowTotal ? (
				<span>{t("common.paginationTotal", { count: totalLabelCount ?? total ?? 0 })}</span>
			) : (
				<span aria-hidden="true" />
			)}
			<div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
				<Button
					aria-label={t("common.previous")}
					data-testid={previousButtonTestId}
					disabled={!previousEnabled || loading}
					onClick={() => {
						if (onPrevious) onPrevious()
						else onPageChange?.(meta.currentPage - 1)
					}}
					size="icon"
					variant="outline"
				>
					<ChevronLeft className="size-4" aria-hidden="true" />
				</Button>
				{showPageIndicator ? (
					<span className="min-w-20 text-center" aria-live="polite">
						{t("common.paginationPage", {
							page: meta.currentPage,
							total: meta.pageCount,
						})}
					</span>
				) : null}
				<Button
					aria-label={t("common.next")}
					data-testid={nextButtonTestId}
					disabled={!nextEnabled || loading}
					onClick={() => {
						if (onNext) onNext()
						else onPageChange?.(meta.currentPage + 1)
					}}
					size="icon"
					variant="outline"
				>
					<ChevronRight className="size-4" aria-hidden="true" />
				</Button>
				{showPageSize ? (
					<Select
						disabled={loading}
						value={String(pageSize)}
						onValueChange={(value) => {
							onPageSizeChange(Number(value))
							onPageChange?.(1)
						}}
					>
						<SelectTrigger
							aria-label={t("common.paginationPageSizeLabel")}
							className="h-8 w-26"
							data-testid={pageSizeTriggerTestId}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{pageSizeOptions.map((value) => (
								<SelectItem data-testid={pageSizeOptionTestId} key={value} value={String(value)}>
									{t("common.paginationPageSize", { count: value })}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
				{canQuickJump ? (
					<label className="flex items-center gap-1 whitespace-nowrap">
						<span>{t("common.paginationJumpToPageLabel")}</span>
						<Input
							aria-label={t("common.paginationJumpToPageLabel")}
							className="h-8 w-14 px-2 text-center"
							data-testid={jumpInputTestId}
							disabled={loading}
							inputMode="numeric"
							max={meta.pageCount}
							min={1}
							onBlur={commitJumpPage}
							onChange={(event) => setJumpPage(event.target.value.replace(/\D/g, ""))}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault()
									commitJumpPage()
								}
							}}
							placeholder={String(meta.currentPage)}
							type="text"
							value={jumpPage}
						/>
					</label>
				) : null}
			</div>
		</div>
	)
}
