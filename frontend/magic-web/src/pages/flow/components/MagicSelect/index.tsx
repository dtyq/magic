/**
 * 仅流程节点可使用
 */
import { Select } from "antd"
import { IconChevronDown, IconX } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import React, { forwardRef, useEffect, useMemo, useRef, useState, memo } from "react"
import { createStyles } from "antd-style"
import BaseDropdownRenderer from "./components/BaseDropdownRenderer"
import { useMagicSelectStyles } from "./styles"
import MagicIcon from "@/components/base/MagicIcon"
import { flowEventBus, FLOW_EVENTS } from "@dtyq/magic-flow/dist/common/BaseUI/Select/constants"

// 导入类型
import type { MagicSelectProps, SelectOption } from "./types"

// 全局样式组件
const useGlobalStyles = createStyles(({ token, prefixCls }) => ({
	"@global": {
		".nowheel": {
			"&::-webkit-scrollbar": {
				width: "6px",
			},

			"&::-webkit-scrollbar-thumb": {
				backgroundColor: token.colorBorderSecondary,
				borderRadius: "3px",

				"&:hover": {
					backgroundColor: token.colorBorder,
				},
			},

			"&::-webkit-scrollbar-track": {
				backgroundColor: "transparent",
			},
		},
	},
}))

// 使用memo包装组件，优化性能
const MagicSelectComponent = forwardRef<any, MagicSelectProps>((props, ref) => {
	const { dropdownRenderProps, eventHandlers, ...restSelectProps } = props
	const { styles } = useMagicSelectStyles()

	// 应用全局样式
	useGlobalStyles()

	const {
		placeholder: dropdownPlaceholder,
		showSearch,
		component: DropdownRenderComp = BaseDropdownRenderer,
		OptionWrapper,
		...restDropdownProps
	} = dropdownRenderProps || {}

	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// 过滤掉不可见的选项
	const filterOptions = useMemo(() => {
		const options = restSelectProps?.options as SelectOption[] | undefined
		return options?.filter((option) => {
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
	const onChangeHooks = useMemoizedFn((event: any) => {
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
		const cleanupFunctions: (() => void)[] = []

		const nodeClickCleanup = flowEventBus.on(FLOW_EVENTS.NODE_SELECTED, handleNodeSelected)
		const edgeClickCleanup = flowEventBus.on(FLOW_EVENTS.EDGE_SELECTED, handleEdgeSelected)
		const canvasClickCleanup = flowEventBus.on(FLOW_EVENTS.CANVAS_CLICKED, handleCanvasClicked)
		cleanupFunctions.push(nodeClickCleanup, edgeClickCleanup, canvasClickCleanup)

		// 返回清理函数
		return () => {
			cleanupFunctions.forEach((cleanup) => cleanup())
		}
	}, [handleNodeSelected, handleEdgeSelected, handleCanvasClicked])

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
		<div ref={containerRef}>
			<Select
				ref={ref}
				{...restSelectProps}
				className={`${restSelectProps.className || ""} nodrag ${styles.selectWrapper}`}
				suffixIcon={
					showSuffixIcon
						? restSelectProps.suffixIcon || (
							<MagicIcon component={IconChevronDown} size={16} />
						)
						: null
				}
				popupClassName={`nowheel ${restSelectProps.popupClassName || ""}`}
				getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
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
				clearIcon={<MagicIcon component={IconX} size={16} className={styles.clearIcon} />}
			/>
		</div>
	)
})

// 使用memo包装组件，提供自定义比较函数
const MagicSelect = memo(MagicSelectComponent)

// 正确处理静态属性
const EnhancedMagicSelect: any = MagicSelect
EnhancedMagicSelect.Option = Select.Option
EnhancedMagicSelect.OptGroup = Select.OptGroup

export default EnhancedMagicSelect
export type { MagicSelectProps, SelectOption }
export { flowEventBus, FLOW_EVENTS }
