import { memo, forwardRef, useCallback, useMemo } from "react"
import type { EmptyProps, FlexProps } from "antd"
import { Flex } from "antd"
import type { ComponentType, ForwardedRef } from "react"
import { isEqual, omit } from "lodash-es"
import { cx } from "antd-style"
import type { MagicListItemData as MagicListItemItemType } from "./types"
import type { MagicListItemProps } from "./MagicListItem"
import MagicListItem from "./MagicListItem"
import MagicEmpty from "@/opensource/components/base/MagicEmpty"

export interface MagicListProps<
	R extends MagicListItemItemType = MagicListItemItemType,
> extends Omit<FlexProps, "children"> {
	items?: (string | R)[]
	emptyProps?: EmptyProps
	active?: string | ((item: R, index: number) => boolean)
	onItemClick?: (data: R) => void
	itemClassName?: string
	itemClassNames?: MagicListItemProps<R>["classNames"]
	listItemProps?: Partial<MagicListItemProps<R>>
	listItemComponent?: ComponentType<MagicListItemProps<R>>
}

// 优化列表项组件，确保只有在必要时才重新渲染
type MagicListItemWrapperProps<R extends MagicListItemItemType> = {
	item: string | R
	index: number
	active: string | ((item: R, index: number) => boolean)
	onItemClick?: (data: R) => void
	itemClassName?: string
	itemClassNames?: MagicListItemProps<R>["classNames"]
	ListItemComponent: ComponentType<MagicListItemProps<R>>
	listItemProps?: Partial<MagicListItemProps<R>>
}

// 单独封装列表项组件，实现精细的重渲染控制
function MagicListItemWrapperComponent<R extends MagicListItemItemType>(
	props: MagicListItemWrapperProps<R>,
) {
	const {
		item: rawItem,
		index,
		active,
		onItemClick,
		itemClassName,
		itemClassNames,
		ListItemComponent,
		listItemProps,
	} = props

	// 处理字符串项，转换为对象
	const item = useMemo(() => {
		if (typeof rawItem === "string") {
			return { id: rawItem } as R
		}
		return rawItem
	}, [rawItem])

	// 计算活动状态，避免在父组件中重复计算
	const activeStatus = useMemo(() => {
		return typeof active === "function" ? active(item, index) : active === item.id
	}, [active, item, index])

	// 记忆化点击处理器
	const handleClick = useCallback(
		(data: R) => {
			if (onItemClick) {
				onItemClick(data)
			}
		},
		[onItemClick],
	)

	return (
		<ListItemComponent
			className={itemClassName}
			classNames={itemClassNames}
			key={item.id}
			active={activeStatus}
			data={item}
			onClick={handleClick}
			{...listItemProps}
		/>
	)
}

// 使用类型安全的方式创建 memo 组件
const MagicListItemWrapper = memo(
	MagicListItemWrapperComponent,
	// 自定义比较函数，避免不必要的重渲染
	<R extends MagicListItemItemType>(
		prevProps: MagicListItemWrapperProps<R>,
		nextProps: MagicListItemWrapperProps<R>,
	) => {
		// 如果item引用相同，直接跳过更新
		if (prevProps.item === nextProps.item) {
			// 但仍需检查其他属性
			return (
				prevProps.active === nextProps.active &&
				prevProps.onItemClick === nextProps.onItemClick &&
				prevProps.itemClassName === nextProps.itemClassName &&
				isEqual(prevProps.itemClassNames, nextProps.itemClassNames) &&
				prevProps.ListItemComponent === nextProps.ListItemComponent &&
				isEqual(prevProps.listItemProps, nextProps.listItemProps)
			)
		}

		// 对于不同引用的item，检查内容是否相同
		if (
			typeof prevProps.item === "object" &&
			typeof nextProps.item === "object" &&
			prevProps.item?.id === nextProps.item?.id &&
			isEqual(prevProps.item, nextProps.item)
		) {
			// 内容相同，检查其他属性
			return (
				prevProps.active === nextProps.active &&
				prevProps.onItemClick === nextProps.onItemClick &&
				prevProps.itemClassName === nextProps.itemClassName &&
				isEqual(prevProps.itemClassNames, nextProps.itemClassNames) &&
				prevProps.ListItemComponent === nextProps.ListItemComponent &&
				isEqual(prevProps.listItemProps, nextProps.listItemProps)
			)
		}

		// 默认情况下，认为组件需要更新
		return false
	},
) as typeof MagicListItemWrapperComponent

const MagicListBase = forwardRef(
	<R extends MagicListItemItemType>(
		props: MagicListProps<R>,
		ref: ForwardedRef<HTMLDivElement>,
	) => {
		const {
			items,
			active = "",
			onItemClick,
			itemClassName,
			itemClassNames,
			listItemComponent: ListItemComponent = MagicListItem as ComponentType<
				MagicListItemProps<R>
			>,
			style,
			emptyProps,
			listItemProps,
			...flexProps
		} = props

		// 记忆化样式，避免每次渲染都创建新样式对象
		const styles = useMemo(() => ({ width: "100%", ...style }), [style])

		// 记忆化列表项数组
		const renderedItems = useMemo(() => {
			if (!items || items.length === 0) return null

			return items.map((item, index) => (
				<MagicListItemWrapper<R>
					key={typeof item === "string" ? item : item.id}
					item={item}
					index={index}
					active={active}
					onItemClick={onItemClick}
					itemClassName={itemClassName}
					itemClassNames={itemClassNames}
					ListItemComponent={ListItemComponent}
					listItemProps={listItemProps}
				/>
			))
		}, [
			items,
			active,
			onItemClick,
			itemClassName,
			itemClassNames,
			ListItemComponent,
			listItemProps,
		])

		// 处理空列表状态
		if (!items || items.length === 0) {
			if (!emptyProps) return null

			return (
				<MagicEmpty
					className={cx(flexProps.className, emptyProps?.className)}
					{...omit(emptyProps, "className")}
				/>
			)
		}

		return (
			<Flex ref={ref} vertical gap={4} style={styles} {...flexProps}>
				{renderedItems}
			</Flex>
		)
	},
)

// 使用 memo 包装组件，提供更好的性能
const MagicListOptimized = memo(MagicListBase) as typeof MagicListBase

export default MagicListOptimized
