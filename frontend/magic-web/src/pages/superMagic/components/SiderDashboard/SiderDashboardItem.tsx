import { useItemStyles } from "./styles"
import { Checkbox, CheckboxChangeEvent, Input, InputRef } from "antd"
import { IconChevronRight, IconDots } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import ActionButton from "../ActionButton"
import {
	useState,
	useRef,
	useMemo,
	forwardRef,
	useImperativeHandle,
	useCallback,
	memo,
} from "react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { DashboardItemData } from "./types"
import { DropdownDelegateProps } from "../SuperMagicDropdown"

interface SiderDashboardItemProps extends DropdownDelegateProps<DashboardItemData> {
	data: DashboardItemData
	deep?: number
	isChecked?: boolean
	isIndeterminate?: boolean
	onCheckChange?: (item: DashboardItemData, checked: boolean) => void
	onRename?: (item: DashboardItemData, newName: string) => void
	isExpanded?: boolean // 外部控制的展开状态
	onExpand?: () => void // 外部控制的展开处理
	onDashboardClick?: (item: DashboardItemData) => void
}

// 定义 ref 暴露的方法接口
export interface SiderDashboardItemRef {
	rename: () => void
}

function SiderDashboardItem(
	{
		data,
		deep = 0,
		isChecked = false,
		isIndeterminate = false,
		onCheckChange,
		onRename,
		isExpanded = false,
		onExpand,
		onDashboardClick,
		...delegateProps
	}: SiderDashboardItemProps,
	ref: React.Ref<SiderDashboardItemRef>,
) {
	const { cx, styles } = useItemStyles()
	const [isRenameing, setIsRenameing] = useState(false)
	const [renameValue, setRenameValue] = useState(data.name)
	const renameInputRef = useRef<InputRef>(null)

	const hasChildren = useMemo(() => {
		return data.type === "folder" && data.children && data.children.length > 0
	}, [data.type, data.children])

	const handleActionClick = (event: React.MouseEvent<HTMLDivElement>) => {
		event.stopPropagation()
		if (delegateProps.onDropdownActionClick) {
			delegateProps.onDropdownActionClick(event, data)
		}
	}

	const handleContextMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (delegateProps.onDropdownContextMenuClick) {
			delegateProps.onDropdownContextMenuClick(event, data)
		}
	}

	const handleExpandToggle = () => {
		if (hasChildren && onExpand) {
			onExpand()
		} else if (onDashboardClick) {
			onDashboardClick(data)
		}
	}

	// 处理 checkbox 变化
	const handleCheckboxChange = (e: CheckboxChangeEvent) => {
		const checked = e.target.checked
		onCheckChange?.(data, checked)
	}

	// 处理重命名输入框的键盘事件
	const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault()
			const trimmedValue = renameValue.trim()
			if (trimmedValue && trimmedValue !== data.name) {
				onRename?.(data, trimmedValue)
			}
			setIsRenameing(false)
		} else if (e.key === "Escape") {
			e.preventDefault()
			setIsRenameing(false)
			setRenameValue(data.name)
		}
	}

	// 处理重命名输入框失去焦点
	const handleRenameBlur = () => {
		const trimmedValue = renameValue.trim()
		if (trimmedValue && trimmedValue !== data.name) {
			onRename?.(data, trimmedValue)
		}
		setIsRenameing(false)
	}

	// 根据层级深度计算缩进
	const indentStyle = useMemo(() => {
		if (data.type === "dashboard") {
			return {
				paddingLeft: `${deep * 22 + 28}px`,
			}
		}
		return {
			paddingLeft: `${deep * 22 + 4}px`,
		}
	}, [data.type, deep])

	// 使用 useMemo 计算箭头图标样式
	const arrowIconStyle = useMemo(
		() => ({
			cursor: hasChildren ? ("pointer" as const) : ("default" as const),
			opacity: hasChildren ? 1 : 0.3,
			transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
			transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
			transformOrigin: "center" as const,
		}),
		[hasChildren, isExpanded],
	)

	// 创建稳定的 rename 方法
	const renameMethod = useCallback(() => {
		setIsRenameing(true)
		setRenameValue(data.name)
		// 延迟聚焦，确保 Input 已经渲染
		setTimeout(() => {
			renameInputRef.current?.focus()
			renameInputRef.current?.select()
		}, 0)
	}, [data.name])

	// 暴露给父组件的方法
	useImperativeHandle(ref, () => {
		return {
			rename: renameMethod,
		}
	}, [renameMethod])

	return (
		<div
			className={cx(styles.item, isRenameing && styles.renameing)}
			onContextMenu={handleContextMenuClick}
			style={indentStyle}
			onClick={handleExpandToggle}
		>
			{data.type === "folder" && (
				<ActionButton size={20} onClick={handleExpandToggle}>
					<MagicIcon
						className={styles.arrowIcon}
						size={18}
						component={IconChevronRight}
						stroke={2}
						style={arrowIconStyle}
					/>
				</ActionButton>
			)}
			<Checkbox
				checked={isChecked}
				indeterminate={isIndeterminate}
				onChange={handleCheckboxChange}
				onClick={(e) => e.stopPropagation()}
			/>
			{data.type === "folder" && (
				<div className={styles.folderIcon}>
					<img src={FoldIcon} alt="folder" width={18} height={18} />
				</div>
			)}
			{data.type === "dashboard" && (
				<MagicFileIcon className={styles.fileIcon} type={"dashboard"} size={18} />
			)}
			{isRenameing ? (
				<Input
					ref={renameInputRef}
					className={styles.renameInput}
					value={renameValue}
					onChange={(e) => setRenameValue(e.target.value)}
					onKeyDown={handleRenameKeyDown}
					onBlur={handleRenameBlur}
					size="small"
				/>
			) : (
				<div className={styles.name} title={data.name}>
					{data.name}
				</div>
			)}
			<div className={styles.moreActionButton}>
				<ActionButton size={20} onClick={handleActionClick}>
					<MagicIcon
						className={styles.arrowIcon}
						size={18}
						component={IconDots}
						stroke={2}
					/>
				</ActionButton>
			</div>
		</div>
	)
}

const SiderDashboardItemMemo = memo(forwardRef(SiderDashboardItem))

export default SiderDashboardItemMemo
