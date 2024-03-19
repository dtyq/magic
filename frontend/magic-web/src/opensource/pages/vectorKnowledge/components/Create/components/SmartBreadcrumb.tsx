import React, { useState, useEffect, useRef } from "react"
import { Dropdown } from "antd"
import { cx, createStyles } from "antd-style"
import IconEllipsis from "@/opensource/enhance/tabler/icons-react/icons/IconEllipsis"
import { IconChevronRight } from "@tabler/icons-react"
import { Knowledge } from "@/opensource/types/knowledge"

// 定义各项目的数据结构
export interface BreadcrumbItem {
	id: string
	name: string
	spaceType: Knowledge.SpaceType
}

interface SmartBreadcrumbProps {
	rootName: string // 根层级的名称
	path: BreadcrumbItem[] // 当前路径项目
	onItemClick: (itemId: string) => void // 点击项目的回调
	className?: string // 外部传入的className
}

// 创建组件样式
const useStyles = createStyles(({ css, token }) => ({
	breadcrumb: css`
		padding: 10px;
		font-size: 14px;
		overflow-x: hidden;
		white-space: nowrap;
	`,
	breadcrumbContent: css`
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: nowrap;
		overflow-x: hidden;
	`,
	breadcrumbItem: css`
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: rgba(28, 29, 35, 0.8);

		&:hover {
			color: ${token.colorPrimary};
		}
	`,
	breadcrumbItemActive: css`
		font-weight: 600;
	`,
}))

const SmartBreadcrumb: React.FC<SmartBreadcrumbProps> = ({
	rootName,
	path,
	onItemClick,
	className,
}) => {
	const { styles, cx: classMerge } = useStyles()

	// 面包屑组件相关状态和引用
	const breadcrumbRef = useRef<HTMLDivElement>(null)
	const [visibleItems, setVisibleItems] = useState<BreadcrumbItem[]>([]) // 可见的前面项目
	const [hiddenItems, setHiddenItems] = useState<BreadcrumbItem[]>([]) // 隐藏的中间项目
	const [showEllipsis, setShowEllipsis] = useState(false)

	// 用于测量文本宽度的canvas
	const textWidthCanvasRef = useRef<HTMLCanvasElement | null>(null)

	// 初始化canvas用于测量文本宽度
	useEffect(() => {
		// 创建canvas元素用于测量文本宽度
		if (!textWidthCanvasRef.current) {
			textWidthCanvasRef.current = document.createElement("canvas")
		}

		return () => {
			textWidthCanvasRef.current = null
		}
	}, [])

	// 精确计算文本宽度的函数
	const getTextWidth = (text: string): number => {
		if (!textWidthCanvasRef.current) {
			return text.length * 14 // 备用计算方法
		}

		const canvas = textWidthCanvasRef.current
		const context = canvas.getContext("2d")
		if (!context) return text.length * 14

		// 设置与实际显示相同的字体
		context.font =
			'14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial'

		// 测量文本宽度
		const metrics = context.measureText(text)

		return metrics.width
	}

	// 处理点击根项目
	const handleRootClick = () => {
		onItemClick("")
	}

	// 计算面包屑项目是否需要省略及如何省略
	useEffect(() => {
		const checkBreadcrumbWidth = () => {
			if (!breadcrumbRef.current || path.length <= 2) {
				setShowEllipsis(false)
				setVisibleItems(path)
				setHiddenItems([])
				return
			}

			const containerWidth = breadcrumbRef.current.parentElement?.clientWidth || 0
			const breadcrumbWidth = breadcrumbRef.current.scrollWidth
			const padding = 40 // 容器的左右内边距总和

			// 精确计算各元素宽度
			const separatorWidth = 16 // 分隔符宽度
			const ellipsisWidth = 23 // 省略号图标宽度
			const gap = 4 // gap间距
			const rootItemWidth = getTextWidth(rootName) // 根层级宽度
			const availableWidth = containerWidth - padding

			// 精确计算每个项目的宽度
			const itemWidths = path.map((item) => getTextWidth(item.name))

			// 如果面包屑宽度超过容器宽度减去内边距，需要显示省略号
			if (breadcrumbWidth > availableWidth) {
				// 保留最后一项（当前层级），从前面尽可能多地保留项目
				const lastItemWidth = itemWidths[itemWidths.length - 1]

				// 已使用的宽度：根项目 + 末尾项目 + 它们的分隔符
				const usedWidth =
					rootItemWidth +
					gap +
					separatorWidth +
					gap +
					lastItemWidth +
					gap +
					separatorWidth +
					gap

				// 最多能显示几个前面的项目
				let visibleCount = 0
				let remainingWidth =
					availableWidth - usedWidth - ellipsisWidth - gap - separatorWidth - gap

				// 从前面开始尝试添加项目
				for (let i = 0; i < path.length - 1; i++) {
					const currentItemWidth = itemWidths[i] + separatorWidth
					if (remainingWidth >= currentItemWidth) {
						visibleCount++
						remainingWidth -= currentItemWidth
					} else {
						break
					}
				}

				// 如果所有项目不能全部显示，则显示省略号
				if (visibleCount < path.length - 1) {
					setVisibleItems(path.slice(0, visibleCount))
					setHiddenItems(path.slice(visibleCount, -1))
					setShowEllipsis(true)
				} else {
					// 所有项目都可以显示
					setVisibleItems(path)
					setHiddenItems([])
					setShowEllipsis(false)
				}
			} else {
				// 所有项目都可以显示
				setVisibleItems(path)
				setHiddenItems([])
				setShowEllipsis(false)
			}
		}

		checkBreadcrumbWidth()
		// 添加窗口大小变化的监听器
		window.addEventListener("resize", checkBreadcrumbWidth)
		return () => {
			window.removeEventListener("resize", checkBreadcrumbWidth)
		}
	}, [path, rootName])

	// 判断是否在根层级（即没有选择任何目录）
	const isAtRootLevel = path.length === 0

	// 面包屑分隔符
	const separator = <IconChevronRight color="rgba(28, 29, 35, 0.35)" size={16} />

	return (
		<div ref={breadcrumbRef} className={classMerge(styles.breadcrumb, className)}>
			<div className={styles.breadcrumbContent}>
				{/* 固定的根层级，当在根层级时添加active样式 */}
				<div
					className={cx(
						styles.breadcrumbItem,
						isAtRootLevel && styles.breadcrumbItemActive,
					)}
					onClick={handleRootClick}
				>
					{rootName}
				</div>

				{showEllipsis ? (
					<>
						{/* 显示可见的前面项目 */}
						{visibleItems.map((item) => (
							<React.Fragment key={item.id}>
								{separator}
								<div
									className={styles.breadcrumbItem}
									onClick={() => onItemClick(item.id)}
								>
									{item.name}
								</div>
							</React.Fragment>
						))}

						{/* 中间项显示为省略号下拉菜单 */}
						{hiddenItems.length > 0 && (
							<>
								{separator}
								<Dropdown
									menu={{
										items: hiddenItems.map((item) => ({
											key: item.id,
											label: item.name,
											onClick: () => onItemClick(item.id),
										})),
									}}
									placement="bottom"
								>
									<div className={styles.breadcrumbItem}>
										<IconEllipsis size={16} />
									</div>
								</Dropdown>
							</>
						)}

						{/* 显示最后一项（当前层级） */}
						{path.length > 0 && (
							<>
								{separator}
								<div
									className={cx(
										styles.breadcrumbItem,
										styles.breadcrumbItemActive,
									)}
									onClick={() => onItemClick(path[path.length - 1].id)}
								>
									{path[path.length - 1].name}
								</div>
							</>
						)}
					</>
				) : (
					<>
						{/* 正常显示所有路径项 */}
						{path.map((item, index) => (
							<React.Fragment key={item.id}>
								{separator}
								<div
									className={cx(
										styles.breadcrumbItem,
										index === path.length - 1 && styles.breadcrumbItemActive,
									)}
									onClick={() => onItemClick(item.id)}
								>
									{item.name}
								</div>
							</React.Fragment>
						))}
					</>
				)}
			</div>
		</div>
	)
}

export default SmartBreadcrumb
