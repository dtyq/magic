import React, { useState, useRef, useMemo, memo } from "react"
import { Popover } from "antd"
import { IconX } from "@tabler/icons-react"
import AtItem from "../AtItem"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { getMentionUniqueId } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type {
	MentionListItem,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { MarkerClickScene } from "../../hooks/useMarkerClickHandler"
import { useMemoizedFn, useDebounceFn, useMount, useUnmount, useUpdateEffect } from "ahooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/lib/utils"
import type { JSONContent } from "@tiptap/core"
import { useTranslation } from "react-i18next"

// 间距
const GAP = 4
const MOBILE_POPUP_ICON_SIZE = 24

// 最大行数
const MAX_ROWS = 2

interface MentionListProps {
	/** mention 项列表 */
	mentionItems: MentionListItem[]
	/** 图标大小 */
	iconSize?: number
	/** 移除 mention 项的回调 */
	onRemoveItems?: (mentionAttrs: TiptapMentionAttributes) => void
	/** 预览元素 */
	prevEl?: React.ReactElement | null
	onFileClick?: (fileItem: TiptapMentionAttributes["data"]) => void
	/** 重试上传文件的回调 */
	onRetry?: (id: string) => Promise<void>
	/** Marker 点击场景（用于决定点击行为） */
	markerClickScene?: MarkerClickScene
	/** 消息的 content（用于消息列表中查找完整 marker 数据） */
	messageContent?: JSONContent | string | Record<string, unknown>
}

/**
 * MentionList - mention 列表组件
 * 显示 @ 按钮和已选择的 mention 项
 * 使用 CSS Grid 自动布局，最多显示两行，超出部分显示在 Popover 中
 */
const MentionList = ({
	mentionItems,
	iconSize,
	onRemoveItems,
	prevEl,
	onFileClick,
	onRetry,
	markerClickScene = "messageEditorMentionList",
	messageContent,
}: MentionListProps) => {
	// 使用 markerClickScene，默认为 messageEditorMentionList
	const scene = markerClickScene
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()
	const containerRef = useRef<HTMLDivElement>(null)
	const [maxVisible, setMaxVisible] = useState(Infinity)
	const isCalculatingRef = useRef(false)
	const [popoverOpen, setPopoverOpen] = useState(false)
	const mobilePopupCloseLabel = t("messageEditor.mentionList.close")

	const hiddenItems = useMemo(() => mentionItems.slice(maxVisible), [mentionItems, maxVisible])
	const mobilePopupTitle = t("messageEditor.mentionList.remainingTitle", {
		count: hiddenItems.length,
	})

	const shouldShowMore = hiddenItems.length > 0

	const calculateMaxVisible = useMemoizedFn(() => {
		// 防止重复计算
		if (isCalculatingRef.current) {
			return
		}

		if (!containerRef.current || mentionItems.length === 0) {
			setMaxVisible(Infinity)
			return
		}

		isCalculatingRef.current = true

		const { mutationObserver } = observersRef.current
		let itemWrappers: HTMLElement[] = []

		try {
			const container = containerRef.current
			const containerWidth = container.clientWidth

			// 暂时断开 MutationObserver，避免修改 display 时触发循环
			if (mutationObserver) {
				mutationObserver.disconnect()
			}

			// 获取所有 item wrapper 元素（跳过 prevEl 和 moreButton）
			const allChildren = Array.from(container.children) as HTMLElement[]
			// 通过 data-mention-item 属性筛选出 wrapper 元素
			itemWrappers = allChildren.filter(
				(el) => el.getAttribute("data-mention-item") !== null,
			) as HTMLElement[]
			if (itemWrappers.length === 0) {
				setMaxVisible(Infinity)
				return
			}

			// 临时显示所有 items 以便测量（保存原始 display 值）
			const originalDisplays: string[] = []
			itemWrappers.forEach((wrapper) => {
				originalDisplays.push(wrapper.style.display || "")
				wrapper.style.display = ""
			})

			// 获取实际的 item 元素（wrapper 内的 AtItem）
			const itemElements = itemWrappers
				.map((wrapper) => wrapper.firstElementChild as HTMLElement)
				.filter(Boolean)

			if (itemElements.length === 0) {
				// 恢复原始 display 值
				itemWrappers.forEach((wrapper, index) => {
					wrapper.style.display = originalDisplays[index] || ""
				})
				setMaxVisible(Infinity)
				return
			}

			// 计算每个项目的宽度和位置信息
			const itemInfo: Array<{ width: number; top: number }> = []
			itemElements.forEach((el) => {
				const rect = el.getBoundingClientRect()
				itemInfo.push({
					width: rect.width, // 不包含 gap，gap 是项目之间的间距
					top: rect.top,
				})
			})

			// 预留 "+N" 按钮的空间（估算最小宽度 28px + gap）
			const moreButtonWidth = 28 + GAP

			// 通过实际测量的 top 位置来判断行数
			let visibleCount = 0
			const rows: number[] = [] // 记录每行的起始索引

			for (let i = 0; i < itemInfo.length; i++) {
				const currentItem = itemInfo[i]
				const isLastItem = i === itemInfo.length - 1

				// 判断当前 item 属于哪一行（通过 top 位置）
				let currentRowIndex = -1
				for (let j = 0; j < rows.length; j++) {
					const rowStartIndex = rows[j]
					const rowStartTop = itemInfo[rowStartIndex].top
					// 如果 top 位置相近（允许 1px 误差），认为是同一行
					if (Math.abs(currentItem.top - rowStartTop) < 2) {
						currentRowIndex = j
						break
					}
				}

				// 如果是新行
				if (currentRowIndex === -1) {
					// 如果超过最大行数，停止计算
					if (rows.length >= MAX_ROWS) {
						break
					}
					currentRowIndex = rows.length
					rows.push(i)
				}

				// 计算当前行的总宽度（包括项目宽度和项目之间的 gap）
				let currentRowWidth = 0
				const itemsInCurrentRow = i - rows[currentRowIndex]
				if (itemsInCurrentRow > 0) {
					// 如果当前行已有项目，需要加上 gap
					for (let j = rows[currentRowIndex]; j < i; j++) {
						currentRowWidth += itemInfo[j].width
					}
					// 项目之间的 gap 数量 = 项目数 - 1
					currentRowWidth += itemsInCurrentRow * GAP
				}

				// 检查当前行是否能放下这个项目
				// 如果当前行已有项目，需要加上 gap；如果是第一个项目，不需要 gap
				const gapBeforeCurrentItem = currentRowWidth > 0 ? GAP : 0
				const canFitInCurrentRow =
					currentRowWidth + gapBeforeCurrentItem + currentItem.width <= containerWidth

				if (!canFitInCurrentRow) {
					// 如果当前行已经有项目，需要换行
					if (currentRowWidth > 0) {
						// 如果超过最大行数，停止计算
						if (rows.length >= MAX_ROWS) {
							break
						}
						// 创建新行
						rows.push(i)
						currentRowWidth = 0
					}

					// 如果单独一行也放不下，就不显示这个项目
					if (currentItem.width > containerWidth) {
						break
					}
				}

				// 如果不是最后一个项目，需要检查是否需要为 "+N" 按钮预留空间
				if (!isLastItem && rows.length === MAX_ROWS) {
					// 检查加上当前项目和 "+N" 按钮是否会超出宽度
					// 当前行宽度 + gap + 当前项目宽度 + gap + "+N"按钮宽度
					const totalWidthWithMoreButton =
						currentRowWidth +
						gapBeforeCurrentItem +
						currentItem.width +
						GAP +
						moreButtonWidth
					if (totalWidthWithMoreButton > containerWidth) {
						// 如果当前行已经有项目，需要换行
						if (currentRowWidth > 0) {
							if (rows.length >= MAX_ROWS) {
								break
							}
							rows.push(i)
							currentRowWidth = 0
						}
						// 如果单独一行也放不下，就不显示这个项目
						// 单独一行：当前项目宽度 + gap + "+N"按钮宽度
						if (currentItem.width + GAP + moreButtonWidth > containerWidth) {
							break
						}
					}
				}

				visibleCount++

				// 更新当前行宽度（加上当前项目）
				if (currentRowWidth > 0) {
					currentRowWidth += GAP + currentItem.width
				} else {
					currentRowWidth = currentItem.width
				}
			}

			// 恢复原始的 display 值，然后根据计算结果设置
			itemWrappers.forEach((wrapper, index) => {
				const shouldBeVisible = index < visibleCount
				wrapper.style.display = shouldBeVisible ? "" : "none"
			})

			setMaxVisible(visibleCount)
		} finally {
			// 确保重新连接 MutationObserver
			if (mutationObserver && containerRef.current) {
				mutationObserver.observe(containerRef.current, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["style", "class", "data-mention-item"],
				})
			}
			// 确保重置标志位
			isCalculatingRef.current = false
		}
	})

	// 防抖的计算函数
	const debouncedCalculateMaxVisible = useDebounceFn(calculateMaxVisible, {
		wait: 100,
	})

	// 使用 ref 保存 Observer 实例，以便在清理时使用
	const observersRef = useRef<{
		containerObserver: ResizeObserver | null
		mutationObserver: MutationObserver | null
	}>({
		containerObserver: null,
		mutationObserver: null,
	})

	// 设置 Observer
	useMount(() => {
		const container = containerRef.current

		if (!container) {
			return
		}

		// 创建 ResizeObserver 监听容器尺寸变化
		const containerObserver = new ResizeObserver(() => {
			debouncedCalculateMaxVisible.run()
		})

		// 创建 MutationObserver 监听容器子元素变化
		const mutationObserver = new MutationObserver(() => {
			debouncedCalculateMaxVisible.run()
		})

		// 开始观察
		containerObserver.observe(container)
		mutationObserver.observe(container, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["style", "class", "data-mention-item"],
		})

		// 保存 Observer 实例
		observersRef.current = {
			containerObserver,
			mutationObserver,
		}

		// 初始计算
		debouncedCalculateMaxVisible.run()
	})

	// 当 mentionItems 变化时重新计算
	useUpdateEffect(() => {
		debouncedCalculateMaxVisible.run()
	}, [mentionItems])

	// 清理 Observer
	useUnmount(() => {
		const { containerObserver, mutationObserver } = observersRef.current
		containerObserver?.disconnect()
		mutationObserver?.disconnect()
		debouncedCalculateMaxVisible.cancel()
	})

	const _onFileClick = useMemoizedFn((item: TiptapMentionAttributes["data"]) => {
		onFileClick?.(item)
		if (isMobile) {
			setPopoverOpen(false)
		}
	})

	// Hidden items content - reuse across desktop and mobile
	const hiddenItemsContent = useMemo(() => {
		if (hiddenItems.length === 0) return null

		return (
			<div className="flex max-h-[240px] w-[180px] flex-col gap-1 overflow-y-auto">
				{hiddenItems.map((at, index) => (
					<AtItem
						key={`${getMentionUniqueId(at.attrs)}-${index}`}
						data={at.attrs}
						onRemove={onRemoveItems}
						className={cn("mb-0 w-full max-w-none", isMobile && "min-h-11 px-3 py-2")}
						labelClassName={isMobile ? "text-xs leading-4" : undefined}
						retryClassName={isMobile ? "text-xs leading-4" : undefined}
						placement="left"
						onFileClick={_onFileClick}
						iconSize={isMobile ? MOBILE_POPUP_ICON_SIZE : iconSize}
						markerClickScene={scene}
						tooltipProps={{
							zIndex: 1051,
						}}
						messageContent={messageContent}
						markerTooltipProps={{
							popoverClassName: "z-[1051]",
							parentPopoverOpen: popoverOpen,
							side: "left",
						}}
					/>
				))}
			</div>
		)
	}, [
		hiddenItems,
		onRemoveItems,
		_onFileClick,
		iconSize,
		scene,
		popoverOpen,
		messageContent,
		isMobile,
	])

	const moreButton = (
		<button
			type="button"
			className={cn(
				"inline-flex h-full items-center justify-center rounded-md border border-border px-1 py-1",
				"font-medium text-foreground",
				"cursor-pointer select-none transition-all duration-200",
				"min-w-[28px] shrink-0 overflow-hidden text-ellipsis text-[10px] leading-[13px]",
				"hover:bg-muted hover:text-foreground active:scale-95",
				"moreButton",
			)}
			onClick={isMobile ? () => setPopoverOpen(true) : undefined}
		>
			+{hiddenItems.length}
		</button>
	)

	const moreContent = isMobile ? (
		<>
			{moreButton}
			<MagicPopup
				visible={popoverOpen}
				onClose={() => setPopoverOpen(false)}
				position="bottom"
				title={mobilePopupTitle}
				bodyClassName="rounded-t-xl bg-card p-0"
				zIndex={1050}
			>
				<div className="flex flex-col bg-card">
					<div className="flex items-center justify-between border-b border-border px-4 py-3">
						<p className="min-w-0 flex-1 truncate text-left text-base font-semibold leading-6 text-foreground">
							{mobilePopupTitle}
						</p>
						<button
							type="button"
							className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							onClick={() => setPopoverOpen(false)}
							aria-label={mobilePopupCloseLabel}
						>
							<IconX size={18} />
						</button>
					</div>
					{hiddenItemsContent}
				</div>
			</MagicPopup>
		</>
	) : (
		<Popover
			content={hiddenItemsContent}
			trigger="hover"
			placement="topRight"
			arrow={false}
			open={popoverOpen}
			onOpenChange={setPopoverOpen}
			styles={{
				body: {
					padding: "6px",
				},
			}}
			zIndex={1050}
		>
			{moreButton}
		</Popover>
	)

	if (!prevEl && mentionItems.length === 0) {
		return null
	}

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative flex max-h-[56px] min-h-6 w-full flex-wrap items-center overflow-hidden",
			)}
			style={{ gap: GAP }}
		>
			{prevEl ? React.cloneElement(prevEl, { id: "list-prev" }) : null}
			{mentionItems.map((at, index) => {
				const isVisible = index < maxVisible
				return (
					<div
						key={`${getMentionUniqueId(at.attrs)}-${index}`}
						style={{ display: isVisible ? undefined : "none" }}
						data-mention-item=""
					>
						<AtItem
							data={at.attrs}
							onRemove={onRemoveItems}
							placement="top"
							flag={isVisible ? "visible" : "hidden"}
							onFileClick={isVisible ? onFileClick : undefined}
							onRetry={isVisible ? onRetry : undefined}
							iconSize={iconSize}
							markerClickScene={scene}
							messageContent={messageContent}
						/>
					</div>
				)
			})}
			{shouldShowMore ? moreContent : null}
		</div>
	)
}

export default memo(MentionList)
