import { Tooltip, Dropdown } from "antd"
import { IconChevronRight, IconDots, IconLock } from "@tabler/icons-react"
import { isEmpty } from "lodash-es"
import { useMemo, useRef, useEffect, useState } from "react"

import FoldIcon from "@/opensource/pages/superMagic/assets/svg/file-folder.svg"
import { useDirectoryStyles } from "../styles"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import {
	estimateBreadcrumbItemWidth,
	BREADCRUMB_SEPARATOR_WIDTH,
	BREADCRUMB_ELLIPSIS_WIDTH,
	BREADCRUMB_PADDING_BUFFER,
} from "../utils"

interface BreadcrumbItem {
	name: string
	id: string
	operation?: string
	children?: BreadcrumbItem[]
}

interface DirectoryBreadcrumbProps {
	items: BreadcrumbItem[]
	loading: boolean
	onItemClick: (item: BreadcrumbItem) => void
	isMobile?: boolean
}

function DirectoryBreadcrumb({
	items,
	loading,
	onItemClick,
	isMobile = false,
}: DirectoryBreadcrumbProps) {
	const { styles } = useDirectoryStyles({ isMobile })
	const breadcrumbRef = useRef<HTMLDivElement>(null)
	const [containerWidth, setContainerWidth] = useState(0)

	// 在挂载和尺寸变化时测量容器宽度
	useEffect(() => {
		if (!breadcrumbRef.current) return

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerWidth(entry.contentRect.width)
			}
		})

		resizeObserver.observe(breadcrumbRef.current)
		return () => resizeObserver.disconnect()
	}, [])

	// 根据可用宽度计算要显示的项
	const displayItems = useMemo(() => {
		// 如果容器宽度尚未测量或项目太少，显示全部
		if (containerWidth === 0 || items.length <= 2) {
			return items
		}

		// 计算显示所有项需要的总宽度
		const itemWidths = items.map(estimateBreadcrumbItemWidth)
		const totalSeparatorsWidth = (items.length - 1) * BREADCRUMB_SEPARATOR_WIDTH
		const totalWidthNeeded =
			itemWidths.reduce((sum, w) => sum + w, 0) +
			totalSeparatorsWidth +
			BREADCRUMB_PADDING_BUFFER

		// 如果所有内容都能放下，显示全部
		if (totalWidthNeeded <= containerWidth) {
			return items
		}

		// 需要折叠一些项 - 始终显示首项和末项
		const firstItem = items[0]
		const lastItem = items[items.length - 1]
		const firstItemWidth = itemWidths[0]
		const lastItemWidth = itemWidths[itemWidths.length - 1]

		// 计算中间项的可用宽度
		// 必需：首项 + 分隔符 + 省略号 + 分隔符 + 末项
		const requiredWidth =
			firstItemWidth +
			BREADCRUMB_SEPARATOR_WIDTH +
			BREADCRUMB_ELLIPSIS_WIDTH +
			BREADCRUMB_SEPARATOR_WIDTH +
			lastItemWidth +
			BREADCRUMB_PADDING_BUFFER

		// 如果连 首项 + 省略号 + 末项 都放不下，还是显示它们
		if (requiredWidth >= containerWidth) {
			return [
				firstItem,
				{
					...firstItem,
					name: "...",
					id: "ellipsis",
					children: items.slice(1, -1),
				},
				lastItem,
			]
		}

		// 尝试从开头尽可能多地放入项（在首项之后，末项之前）
		const availableWidth = containerWidth - requiredWidth
		let accumulatedWidth = 0
		let visibleMiddleCount = 0

		// 检查中间项（排除首项和末项）
		for (let i = 1; i < items.length - 1; i++) {
			const itemWidth = itemWidths[i] + BREADCRUMB_SEPARATOR_WIDTH
			if (accumulatedWidth + itemWidth <= availableWidth) {
				accumulatedWidth += itemWidth
				visibleMiddleCount++
			} else {
				break
			}
		}

		// 如果可以显示所有中间项，则不需要省略号
		if (visibleMiddleCount === items.length - 2) {
			return items
		}

		// 构建显示数组：首项 + 可见的中间项 + 省略号 + 末项
		const result: BreadcrumbItem[] = [firstItem]

		// 添加可见的中间项
		for (let i = 1; i <= visibleMiddleCount; i++) {
			result.push(items[i])
		}

		// 添加省略号及其包含的隐藏项
		const hiddenItems = items.slice(visibleMiddleCount + 1, -1)
		if (hiddenItems.length > 0) {
			result.push({
				...firstItem,
				name: "...",
				id: "ellipsis",
				children: hiddenItems,
			})
		}

		// 添加末项
		result.push(lastItem)

		return result
	}, [items, containerWidth])

	const renderBreadcrumbItem = (item: BreadcrumbItem) => {
		if (item.id === "ellipsis" && !isEmpty(item.children)) {
			// 渲染省略号下拉菜单
			return (
				<Dropdown
					key="ellipsis"
					placement="bottomLeft"
					menu={{
						items: item.children?.map((subitem, j) => ({
							key: j,
							label: (
								<FlexBox
									className={styles.menuItem}
									onClick={() => onItemClick(subitem)}
									gap={8}
								>
									<div className={styles.folderIconContainer}>
										<img src={FoldIcon} alt="folder" width={14} height={14} />
									</div>
									{!subitem.operation && (
										<IconLock className={styles.lockIcon} size={12} />
									)}
									<Tooltip title={subitem.name} placement="topLeft">
										<span className={styles.name}>{subitem.name}</span>
									</Tooltip>
								</FlexBox>
							),
						})),
					}}
				>
					<div className={`${styles.breadcrumbItem} ellipsis`}>
						<MagicIcon
							component={IconDots}
							color="currentColor"
							className={styles.ellipsisIcon}
							size={16}
						/>
					</div>
				</Dropdown>
			)
		}

		// 渲染普通面包屑项
		return (
			<div
				key={item.id}
				className={[styles.breadcrumbItem, loading ? "disable" : ""].join(" ")}
				onClick={() => onItemClick(item)}
			>
				{!item.operation && <IconLock className={styles.lockIcon} size={12} />}
				<Tooltip title={item.name} placement="topLeft">
					<span className={styles.name}>{item.name}</span>
				</Tooltip>
			</div>
		)
	}

	return (
		<div ref={breadcrumbRef} className={styles.breadcrumb}>
			{displayItems.map((item, i) => (
				<div key={i} style={{ display: "flex", alignItems: "center" }}>
					{renderBreadcrumbItem(item)}
					{i < displayItems.length - 1 && (
						<IconChevronRight className={styles.seperatorIcon} size={18} />
					)}
				</div>
			))}
		</div>
	)
}

export default DirectoryBreadcrumb
