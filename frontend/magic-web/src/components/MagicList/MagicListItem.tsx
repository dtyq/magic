import { Flex } from "antd"
import { cx } from "antd-style"
import { useMemo, memo, useRef, useCallback } from "react"
import type { MouseEventHandler, HTMLAttributes } from "react"
import MagicAvatar from "@/components/base/MagicAvatar"
import { useHover } from "ahooks"
import type { MagicListItemData as MagicListItemType } from "./types"
import { useMagicListItemStyles } from "./styles"

export interface MagicListItemProps<D extends MagicListItemType = MagicListItemType> extends Omit<
	HTMLAttributes<HTMLDivElement>,
	"data" | "onClick" | "children"
> {
	data: D
	active?: boolean
	titleMaxWidth?: number
	onClick?: (data: D) => void
	classNames?: {
		container?: string
		avatar?: string
		title?: string
		content?: string
	}
}

// 将复杂的Avatar渲染逻辑抽离为独立组件
const ItemAvatar = memo(
	<D extends MagicListItemType>({
		avatar,
		isHover,
		className,
	}: {
		avatar: D["avatar"]
		isHover: boolean
		className?: string
	}) => {
		// 如果没有头像，返回null
		if (!avatar) return null

		// 如果是函数，调用函数
		if (typeof avatar === "function") return avatar(isHover)

		// 如果是字符串，渲染简单头像
		if (typeof avatar === "string")
			return <MagicAvatar size="large" src={avatar} className={className} />

		// 如果是对象，渲染带属性的头像
		return <MagicAvatar size="large" src={avatar.src} className={className} {...avatar} />
	},
	(prev, next) => {
		// 自定义比较函数，优化渲染
		if (prev.isHover !== next.isHover) return false
		if (prev.className !== next.className) return false

		// 如果avatar是函数，我们总是重新渲染，因为无法比较函数内容
		if (typeof prev.avatar === "function" || typeof next.avatar === "function") return false

		// 简单比较字符串或对象引用
		return prev.avatar === next.avatar
	},
)

// 标题组件，单独处理标题渲染逻辑
const ItemTitle = memo(
	<D extends MagicListItemType>({ title, isHover }: { title: D["title"]; isHover: boolean }) => {
		const renderedTitle = useMemo(() => {
			if (typeof title === "function") return title(isHover)
			return title
		}, [title, isHover])

		// 直接返回渲染后的标题，不使用Fragment
		return renderedTitle as React.ReactNode
	},
	(prev, next) => {
		if (prev.isHover !== next.isHover) return false

		// 如果title是函数，我们总是重新渲染，因为无法比较函数内容
		if (typeof prev.title === "function" || typeof next.title === "function") return false

		return prev.title === next.title
	},
)

// 悬停内容组件
const HoverSection = memo(
	({
		content,
		isHover,
		onClickHandler,
	}: {
		content: React.ReactNode
		isHover: boolean
		onClickHandler: MouseEventHandler<HTMLDivElement>
	}) => {
		const { styles } = useMagicListItemStyles()

		if (!content) return null

		return (
			<div
				style={{ display: isHover ? "block" : "none" }}
				className={styles.extra}
				onClick={onClickHandler}
			>
				{content}
			</div>
		)
	},
	(prev, next) => {
		return (
			prev.isHover === next.isHover &&
			prev.content === next.content &&
			prev.onClickHandler === next.onClickHandler
		)
	},
)

// 主组件实现
function MagicListItemBase<D extends MagicListItemType = MagicListItemType>({
	data,
	active,
	className,
	classNames,
	onClick,
	...props
}: MagicListItemProps<D>) {
	const { styles } = useMagicListItemStyles()
	const ref = useRef<HTMLDivElement | null>(null)
	const isHover = useHover(ref)

	// 使用 useCallback 记忆化事件处理函数
	const handleMore = useCallback<MouseEventHandler<HTMLDivElement>>((e) => {
		e.stopPropagation()
	}, [])

	const handleClick = useCallback<MouseEventHandler<HTMLDivElement>>(() => {
		onClick?.(data)
	}, [data, onClick])

	// 使用 useMemo 计算 class 名称，避免每次渲染重新计算
	const containerClassName = useMemo(() => {
		return cx(
			styles.container,
			active ? styles.active : undefined,
			className,
			classNames?.container,
		)
	}, [styles.container, styles.active, active, className, classNames?.container])

	return (
		<Flex
			ref={ref}
			className={containerClassName}
			gap={8}
			align="center"
			onClick={handleClick}
			role="listitem"
			data-testid="magic-list-item"
			{...props}
		>
			{data.avatar && (
				<div style={{ flexShrink: 0 }}>
					<ItemAvatar
						avatar={data.avatar}
						isHover={isHover}
						className={classNames?.avatar}
					/>
				</div>
			)}
			<Flex vertical flex={1} justify="space-between" className={styles.mainWrapper}>
				<ItemTitle title={data.title} isHover={isHover} />
			</Flex>
			<HoverSection
				content={data.hoverSection}
				isHover={isHover}
				onClickHandler={handleMore}
			/>
		</Flex>
	)
}

// 使用 memo 包装组件，并提供自定义比较函数以进一步优化性能
const MagicListItemOptimized = memo(MagicListItemBase, (prevProps, nextProps) => {
	// 如果 active 状态、className 或 classNames 改变，我们需要重新渲染
	if (prevProps.active !== nextProps.active) return false
	if (prevProps.className !== nextProps.className) return false
	if (
		prevProps.classNames !== nextProps.classNames &&
		(prevProps.classNames?.container !== nextProps.classNames?.container ||
			prevProps.classNames?.avatar !== nextProps.classNames?.avatar ||
			prevProps.classNames?.title !== nextProps.classNames?.title ||
			prevProps.classNames?.content !== nextProps.classNames?.content)
	) {
		return false
	}

	// 如果点击处理程序改变，我们需要重新渲染
	if (prevProps.onClick !== nextProps.onClick) return false

	// 最关键的比较：数据是否改变
	// 如果数据ID相同且内容没有变化，我们可以跳过渲染
	const prevData = prevProps.data
	const nextData = nextProps.data

	// 首先比较ID，这是必须相同的
	if (prevData.id !== nextData.id) return false

	// 然后比较其他重要属性，如 title, avatar 和 hoverSection
	if (prevData.title !== nextData.title) return false
	if (prevData.avatar !== nextData.avatar) return false
	if (prevData.hoverSection !== nextData.hoverSection) return false

	// 如果所有关键属性都相同，我们可以跳过重新渲染
	return true
}) as typeof MagicListItemBase

export default MagicListItemOptimized
