import MagicConditionEdit, { ConditionInstance } from "@/MagicConditionEdit"
import { Expression } from "@/MagicConditionEdit/types/expression"
import CustomHandle from "@/MagicFlow/nodes/common/Handle/Source"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import clsx from "clsx"
import React, { useMemo } from "react"
import { IfBranch } from "../../helpers"
import styles from "./index.module.less"

type BranchItemProps = React.PropsWithChildren<{
	value: IfBranch
	onChange: (value: Expression.Condition | undefined, branchIndex: number) => void
	showTrash: boolean
	isLast: boolean
	onAddItem: (beforeIndex: number) => void
	onDeleteItem: (index: number) => void
	currentIndex: number
	conditionRefsMap: {
		id: string
		ref: React.RefObject<ConditionInstance>
	}[]
	expressionDataSource: DataSourceOption[]
}>

export default function BranchItem({
	value,
	onChange,
	showTrash,
	isLast,
	onAddItem,
	onDeleteItem,
	currentIndex,
	conditionRefsMap,
	expressionDataSource,
}: BranchItemProps) {
	const { currentNode } = useCurrentNode()

	const SuffixIcon = useMemo(() => {
		return (
			<div style={{ display: "flex" }}>
				{showTrash && (
					<IconTrash
						stroke={1}
						color="#1C1D2399"
						size={20}
						className={styles.trash}
						onClick={() => onDeleteItem(currentIndex)}
					/>
				)}
				<IconPlus
					stroke={1}
					color="#315CEC"
					size={20}
					className={styles.plus}
					onClick={() => onAddItem(currentIndex)}
				/>
			</div>
		)
	}, [showTrash, onDeleteItem, onAddItem, currentIndex])

	const BranchParams = useMemo(() => {
		return isLast ? (
			<div className={styles.elseItem}>否则</div>
		) : (
			<DropdownCard title="如果" height="auto" suffixIcon={SuffixIcon}>
				<div className={styles.branchItem}>
					<MagicConditionEdit
						value={value?.parameters?.structure}
						onChange={(structure) => onChange(structure, currentIndex)}
						dataSource={expressionDataSource}
						ref={conditionRefsMap[currentIndex].ref}
					/>
				</div>
			</DropdownCard>
		)
	}, [
		isLast,
		SuffixIcon,
		value?.parameters?.structure,
		onChange,
		expressionDataSource,
		conditionRefsMap,
		currentIndex,
	])

	return (
		<div className={clsx(styles.branchListItem, "branch-list-item")}>
			<CustomHandle
				type="source"
				isConnectable
				nodeId={currentNode?.node_id || ""}
				isSelected
				id={`${value?.branch_id}`}
			/>
			{BranchParams}
		</div>
	)
}
