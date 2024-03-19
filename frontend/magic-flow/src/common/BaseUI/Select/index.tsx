/**
 * 仅流程节点可使用
 */
import { Select } from "antd"
import { IconChevronDown, IconX } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import React, { ReactElement, forwardRef, useEffect, useMemo, useRef, useState, memo } from "react"
import BaseDropdownRenderer from "../DropdownRenderer/Base"
import styles from "./index.module.less"
import { GlobalStyle } from "./style"
import { FLOW_EVENTS, flowEventBus } from "./constants"

// 外部传入的事件处理函数类型
export type SelectEventHandlers = {
	onNodeSelected?: (nodeId?: string) => void
	onEdgeSelected?: (edgeId?: string) => void
	onCanvasClicked?: (position?: { x: number; y: number }) => void
}

type TsSelectProps = {
	className?: string
	suffixIcon?: React.ReactElement
	popupClassName?: string
	dropdownRenderProps?: {
		// 搜索框占位符
		placeholder?: string
		// 实际渲染组件
		component?: () => ReactElement
		// 是否显示搜索框
		showSearch?: boolean
		// Option的包裹层组件
		OptionWrapper: React.FC<any>
		[key: string]: any
	}
	// 新增可选的关闭下拉菜单的外部事件处理函数
	eventHandlers?: SelectEventHandlers
	[key: string]: any
}

// 使用memo包装组件，优化性能
const MagicSelectComponent = forwardRef((props: TsSelectProps, ref: any) => {
	const { dropdownRenderProps, eventHandlers, ...restSelectProps } = props

	const {
		placeholder: dropdownPlaceholder,
		showSearch,
		component: DropdownRenderComp = BaseDropdownRenderer,
		OptionWrapper,
		...restDropdownProps
	} = (dropdownRenderProps || {})!

	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null) // 引用容器

	// 过滤掉不可见的选项
	const filterOptions = useMemo(() => {
		// @ts-ignore
		return restSelectProps?.options?.filter((option) => {
			if (!Reflect.has(option, "visible")) return true
			return Reflect.get(option, "visible")
		})
	}, [restSelectProps.options])

	// 根据是否允许清除和当前值确定是否显示后缀图标
	const showSuffixIcon = useMemo(() => {
		if (!Reflect.has(restSelectProps, "allowClear")) return true
		const allowClear = Reflect.get(restSelectProps, "allowClear")
		return allowClear && !restSelectProps.value
	}, [restSelectProps.allowClear, restSelectProps.value])

	// 拦截onChange做一些额外事件
	const onChangeHooks = useMemoizedFn((event) => {
		restSelectProps.onChange?.(event)
		setOpen(false)
	})

	// 创建一个事件监听系统，替代对Context的直接依赖
	const closeDropdown = useMemoizedFn(() => {
		setOpen(false)
	})

	const handleNodeSelected = useMemoizedFn((e: CustomEvent) => {
		closeDropdown()
		eventHandlers?.onNodeSelected?.(e.detail)
	})

	const handleEdgeSelected = useMemoizedFn((e: CustomEvent) => {
		closeDropdown()
		eventHandlers?.onEdgeSelected?.(e.detail)
	})

	const handleCanvasClicked = useMemoizedFn((e: CustomEvent) => {
		closeDropdown()
		eventHandlers?.onCanvasClicked?.(e.detail)
	})

	// 监听外部事件以关闭下拉菜单
	useEffect(() => {
		// 清理函数数组
		const cleanupFunctions = []

		const nodeClickCleanup = flowEventBus.on(FLOW_EVENTS.NODE_SELECTED, handleNodeSelected)
		const edgeClickCleanup = flowEventBus.on(FLOW_EVENTS.EDGE_SELECTED, handleEdgeSelected)
		const canvasClickCleanup = flowEventBus.on(FLOW_EVENTS.CANVAS_CLICKED, handleCanvasClicked)
		cleanupFunctions.push(nodeClickCleanup, edgeClickCleanup, canvasClickCleanup)

		// 返回清理函数
		return () => {
			cleanupFunctions.forEach((cleanup) => cleanup())
		}
	}, [eventHandlers])

	// 点击外部关闭下拉菜单
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	return (
		<>
			<GlobalStyle />
			<div ref={containerRef}>
				<Select
					ref={ref}
					{...restSelectProps}
					className={`${restSelectProps.className || ""} nodrag ${styles.selectWrapper}`}
					suffixIcon={
						showSuffixIcon ? restSelectProps.suffixIcon || <IconChevronDown /> : null
					}
					popupClassName={`nowheel ${restSelectProps.popupClassName || ""}`}
					getPopupContainer={(triggerNode) => triggerNode.parentNode}
					open={open}
					onClick={(e) => {
						if (!open) {
							e.stopPropagation()
							setOpen(true)
							restSelectProps?.onClick?.(e)
						}
					}}
					onChange={onChangeHooks}
					dropdownRender={
						dropdownRenderProps
							? () => (
									<DropdownRenderComp
										options={filterOptions}
										placeholder={dropdownPlaceholder}
										value={restSelectProps.value}
										onChange={onChangeHooks}
										showSearch={showSearch}
										multiple={restSelectProps.mode === "multiple"}
										OptionWrapper={OptionWrapper}
										{...restDropdownProps}
									/>
							  )
							: // 加一层包裹避免onClick事件上浮
							  (menu) => <div onClick={(e) => e.stopPropagation()}>{menu}</div>
					}
					clearIcon={<IconX size={16} className={styles.clearIcon} />}
				/>
			</div>
		</>
	)
})

// 使用memo包装组件，提供自定义比较函数
const MagicSelect = memo(MagicSelectComponent)

// 正确处理静态属性
const EnhancedMagicSelect: any = MagicSelect
EnhancedMagicSelect.Option = Select.Option
EnhancedMagicSelect.OptGroup = Select.OptGroup

export default EnhancedMagicSelect
