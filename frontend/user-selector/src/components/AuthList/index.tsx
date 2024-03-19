import { memo, useMemo, useState } from "react"
import { useControllableValue, useMemoizedFn } from "ahooks"
import { cn } from "@/lib/utils"
import type { BaseProps, TreeNode } from "@/components/UserSelector/types"
import { NodeType, OperationTypes } from "@/components/UserSelector/types"
import DepartmentAvatar from "@/components/IconAvatar"
import SelectedText from "../SelectedPanel/components/SelectedText"
import { useAppearance } from "@/context/AppearanceProvider"
import Avatar from "../Avatar"
import { IconTrash, IconUsers } from "@tabler/icons-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { SelectWrapper } from "@/components/ui/select-wrapper"

export interface AuthListProps extends BaseProps {
	/* 禁选列表 */
	disabled?: TreeNode[]
	/* 是否显示checkbox */
	checkbox?: boolean
	/* 已选列表 */
	selected?: TreeNode[]
	/* 选中值变化 */
	onSelectChange?: (selected: TreeNode[]) => void
}

function AuthList(props: AuthListProps) {
	const { getLocale, theme } = useAppearance()
	const locale = getLocale()

	const { disabled, checkbox = true, selected, className, style } = props
	const [innerCheckedList, setInnerCheckedList] = useState<TreeNode[]>(selected || [])

	const [selectedAuthList, setSelectedAuthList] = useControllableValue<TreeNode[]>(props, {
		defaultValue: selected,
		valuePropName: "selected",
		trigger: "onSelectChange",
	})

	const operationOptions = useMemo(() => {
		return [
			{
				label: locale.owner,
				value: OperationTypes.Owner,
				disabled: true,
			},
			{
				label: locale.admin,
				value: OperationTypes.Admin,
			},
			{
				label: locale.edit,
				value: OperationTypes.Edit,
			},
			{
				label: locale.read,
				value: OperationTypes.Read,
			},
		]
	}, [locale])

	// 真正被选中的列表, 权限列表中被选中的项
	const selectedList = useMemo(() => {
		return selectedAuthList?.filter((item) => innerCheckedList.some((i) => i.id === item.id))
	}, [selectedAuthList, innerCheckedList])

	const checkAll = useMemo(
		() =>
			!!selectedAuthList?.length &&
			selectedAuthList.every((item) => innerCheckedList.find((i) => i.id === item.id)),
		[selectedAuthList, innerCheckedList],
	)

	const checkSome = useMemo(
		() =>
			!!selectedAuthList?.length &&
			!checkAll &&
			selectedAuthList.some((item) => innerCheckedList.find((i) => i.id === item.id)),
		[checkAll, selectedAuthList, innerCheckedList],
	)

	const handleCheckAll = (checked: boolean) => {
		if (checked) {
			setInnerCheckedList(selectedAuthList || [])
		} else {
			setInnerCheckedList([])
		}
	}

	const getAvatar = useMemoizedFn((item: TreeNode) => {
		if ([NodeType.User, NodeType.Group].includes(item.dataType)) {
			const avatarSrc = item.avatar_url ?? item.avatar
			return (
				<Avatar
					shape="square"
					src={typeof avatarSrc === "string" ? avatarSrc : undefined}
					size={24}
				>
					{String(item.name ?? "")}
				</Avatar>
			)
		}
		if (item.dataType === NodeType.Department) {
			return <DepartmentAvatar name={String(item.name ?? "")} size={24} iconSize={18} />
		}
		if (item.dataType === NodeType.UserGroup) {
			return (
				<DepartmentAvatar
					name={String(item.name ?? "")}
					size={24}
					icon={<IconUsers size={18} />}
				/>
			)
		}
		return null
	})

	const onBatchChange = (operation: OperationTypes) => {
		const newValue = innerCheckedList.map((i) => {
			if (isDisabled(i)) return i
			return { ...i, operation }
		})
		setSelectedAuthList((prev) =>
			prev.map((i) =>
				newValue.find((j) => j.id === i.id && !isDisabled(j)) ? { ...i, operation } : i,
			),
		)
		setInnerCheckedList([])
	}

	const onOperationChange = (operation: OperationTypes, item: TreeNode) => {
		setSelectedAuthList((prev) => prev.map((i) => (i.id === item.id ? { ...i, operation } : i)))
		setInnerCheckedList((prev) => prev.map((i) => (i.id === item.id ? { ...i, operation } : i)))
	}

	const onCheckboxChange = (checked: boolean, item: TreeNode) => {
		console.log(checked, item)
		if (checked) {
			setInnerCheckedList([...innerCheckedList, item])
		} else {
			setInnerCheckedList(innerCheckedList.filter((i) => i.id !== item.id))
		}
	}

	const isDisabled = useMemoizedFn((item: TreeNode) => {
		return item?.canEdit === false || disabled?.some((i) => i.id === item.id)
	})

	const onRemove = (item: TreeNode) => {
		setSelectedAuthList((prev) => prev.filter((i) => i.id !== item.id))
		setInnerCheckedList((prev) => prev.filter((i) => i.id !== item.id))
	}

	return (
		<div
			className={cn("flex flex-col overflow-hidden gap-3", className)}
			style={style}
			data-theme={theme}
		>
			<SelectedText
				className="z-[1] px-1.5"
				selected={selectedList}
				checkbox
				checkAll={checkAll}
				checkSome={checkSome}
				onCheckAll={handleCheckAll}
			>
				<div className="flex items-center gap-2">
					<span className="text-sm text-secondary-foreground">{locale.batchSet}</span>
					<SelectWrapper
						style={{ width: 100 }}
						options={operationOptions}
						onChange={(value) => onBatchChange(value as OperationTypes)}
						className="text-foreground"
						popupClassName={theme === "dark" ? "bg-[#232429]" : ""}
						dropdownRender={(menu) => {
							return <div data-theme={theme}>{menu}</div>
						}}
					/>
				</div>
			</SelectedText>
			<div className="flex flex-col overflow-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{selectedAuthList?.map((item) => {
					const title = String(item.name ?? item.real_name ?? "")
					const operationValue =
						typeof item.operation === "number" || typeof item.operation === "string"
							? item.operation
							: undefined
					return (
						<div
							key={item.id}
							className="text-foreground-secondary flex cursor-pointer items-center justify-between gap-2 border-b border-border px-1.5 py-2.5 text-sm leading-5"
						>
							<div className="flex items-center gap-2">
								{checkbox && (
									<Checkbox
										checked={
											isDisabled(item) ||
											!!innerCheckedList.find((i) => i.id === item.id)
										}
										onCheckedChange={(checked) => {
											console.log(checked)
											onCheckboxChange(checked === true, item)
										}}
										disabled={isDisabled(item)}
										className="shrink-0"
									/>
								)}
								<div className="flex items-center gap-1">
									{getAvatar(item)}
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="line-clamp-1 text-foreground">
													{title}
												</span>
											</TooltipTrigger>
											{title.length > 10 && (
												<TooltipContent>
													<p>{title}</p>
												</TooltipContent>
											)}
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
							<div className="flex items-center gap-1">
								<SelectWrapper
									style={{ width: 100 }}
									value={operationValue}
									onChange={(value) =>
										onOperationChange(value as OperationTypes, item)
									}
									options={operationOptions}
									disabled={isDisabled(item)}
									className="text-foreground"
									popupClassName={theme === "dark" ? "bg-[#232429]" : ""}
									dropdownRender={(menu) => <div data-theme={theme}>{menu}</div>}
								/>
								<Button
									variant="outline"
									className="h-9 rounded-lg border-border bg-background px-3 text-foreground disabled:border-border disabled:bg-accent disabled:text-muted-foreground"
									onClick={() => onRemove(item)}
									disabled={isDisabled(item)}
								>
									<IconTrash size={16} />
								</Button>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export default memo(AuthList)
