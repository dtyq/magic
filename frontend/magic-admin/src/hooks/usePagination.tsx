import { useMemoizedFn } from "ahooks"
import type { TablePaginationConfig } from "antd"
import { useTranslation } from "react-i18next"
import { MagicButton } from "components"
import type { PageParams } from "@/types/common"

interface UsePaginationProps<T extends PageParams> {
	/** 当前分页参数 */
	params: T
	/** 更新分页参数 */
	setParams?: (params: T) => void
	/** 数据获取函数 */
	fetchData?: (params: T) => void
	/** 列表数据 */
	data: any[]
	/** 总数（精确分页） */
	total?: number
	/** 是否有更多（非精确分页） */
	hasMore?: boolean
	/** 分页器位置 */
	position?: TablePaginationConfig["position"]
}

interface UsePaginationReturn {
	/** Ant Design 分页配置 */
	paginationConfig: TablePaginationConfig
	/** 页码变化处理函数 */
	onPageChange: (page: number, pageSize: number) => void
}

/**
 * 统一的分页管理 hook
 * 整合分页参数更新和配置生成逻辑
 */
export function usePagination<T extends PageParams>({
	params,
	setParams,
	fetchData,
	data,
	total,
	hasMore,
	position = ["bottomLeft"],
}: UsePaginationProps<T>): UsePaginationReturn {
	const { t } = useTranslation("admin/common")

	const onPageChange = useMemoizedFn((page: number, pageSize: number) => {
		// pageSize 变化时重置到第一页
		const newParams =
			pageSize !== params.page_size
				? { ...params, page: 1, page_size: pageSize }
				: { ...params, page }

		setParams?.(newParams as T)
		fetchData?.(newParams as T)
	})

	const paginationConfig: TablePaginationConfig = {
		current: params.page,
		pageSize: params.page_size,
		position,
		showQuickJumper: !!total,
		total: total || 999999,
		pageSizeOptions: [10, 20, 50],
		showSizeChanger: true,
		onChange: onPageChange,
		showTotal: () => {
			return total ? t("totalItems", { total }) : null
		},
		...(total
			? {}
			: {
					itemRender: (_, type) => {
						if (data?.length === 0) return null
						if (type === "prev")
							return (
								<MagicButton type="link" disabled={params.page === 1}>
									{t("prePage")}
								</MagicButton>
							)
						if (type === "next")
							return hasMore ? (
								<MagicButton type="link" disabled={!hasMore}>
									{t("nextPage")}
								</MagicButton>
							) : null
						return null
					},
				}),
	}

	return {
		paginationConfig,
		onPageChange,
	}
}
