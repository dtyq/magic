import { memo } from "react"
import type { ReactNode, MouseEvent } from "react"
import {
	type BaseProps,
	type TreeNode,
	type CheckboxOptions,
} from "@/components/UserSelector/types"
import { cn } from "@/lib/utils"
import TagList from "../TagList"
import AuthList from "../AuthList"
import { useAppearance } from "@/context/AppearanceProvider"
import { Button } from "@/components/ui/button"

export interface SelectedPanelProps extends BaseProps {
	/** 是否显示权限列表 */
	useAuthPanel?: boolean
	/** 取消按钮文本 */
	cancelText?: ReactNode
	/** 确定按钮文本 */
	okText?: ReactNode
	/** 已选/禁选 */
	checkboxOptions?: CheckboxOptions<TreeNode>
	/** 移除按钮事件 */
	onClose?: (value: TreeNode) => void
	/** 取消按钮事件 */
	onCancel?: (e: MouseEvent<HTMLButtonElement>) => void
	/** 确定按钮事件 */
	onOk?: (e: MouseEvent<HTMLButtonElement>) => void
	/** 顶部渲染 */
	renderRightTop?: (nodes: TreeNode[]) => ReactNode
	/** 底部渲染 */
	renderRightBottom?: (nodes: TreeNode[]) => ReactNode
	/** 是否隐藏底部 */
	hideFooter?: boolean
}

function SelectedPanel({
	useAuthPanel,
	className,
	style,
	cancelText,
	okText,
	checkboxOptions,
	onClose,
	onCancel,
	onOk,
	renderRightTop,
	renderRightBottom,
	hideFooter = false,
}: SelectedPanelProps) {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	return (
		<div className={cn("flex flex-col h-full", className)} style={style}>
			<div className="flex flex-1 flex-col overflow-hidden p-3">
				{renderRightTop?.(checkboxOptions?.checked || [])}
				{useAuthPanel ? (
					<AuthList
						disabled={checkboxOptions?.disabled}
						selected={checkboxOptions?.checked}
						onSelectChange={checkboxOptions?.onChange}
					/>
				) : (
					<TagList
						selected={checkboxOptions?.checked}
						disabledNodes={checkboxOptions?.disabled}
						onClose={onClose}
						className="p-0"
					/>
				)}
				{renderRightBottom?.(checkboxOptions?.checked || [])}
			</div>
			{!hideFooter && (
				<div className="mt-auto flex w-full shrink-0 justify-end gap-2.5 border-t border-border p-3">
					<Button
						variant="outline"
						className="h-9 rounded-md border-input bg-background px-4 shadow-sm hover:bg-accent hover:text-accent-foreground"
						onClick={onCancel}
					>
						{cancelText || locale.cancel}
					</Button>
					<Button
						variant="default"
						className="h-9 rounded-md bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90"
						onClick={onOk}
					>
						{okText || locale.ok}
					</Button>
				</div>
			)}
		</div>
	)
}

export default memo(SelectedPanel)
