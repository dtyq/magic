import SourceHandle from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/Handle/Source"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import MagicConditionEdit from "@dtyq/magic-flow/dist/MagicConditionEdit"
import type { IfBranch } from "@/types/flow"
import { useMemo } from "react"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import type { ConditionInstance } from "@dtyq/magic-flow/dist/MagicConditionEdit/index"
import type { Expression } from "@dtyq/magic-flow/dist/MagicConditionEdit/types/expression"
import { Flex } from "antd"
import type { DataSourceOption } from "@dtyq/magic-flow/dist/common/BaseUI/DropdownRenderer/Reference"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
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
	const { t } = useTranslation()

	const { currentNode } = useCurrentNode()

	const SuffixIcon = useMemo(() => {
		return (
			<Flex gap="6px">
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
			</Flex>
		)
	}, [showTrash, onDeleteItem, onAddItem, currentIndex])

	const BranchParams = useMemo(() => {
		return isLast ? (
			<div className={styles.elseItem}>{t("common.else", { ns: "flow" })}</div>
		) : (
			// @ts-ignore
			<DropdownCard
				title={t("common.if", { ns: "flow" })}
				height="auto"
				suffixIcon={SuffixIcon}
			>
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
		t,
		SuffixIcon,
		value?.parameters?.structure,
		expressionDataSource,
		conditionRefsMap,
		currentIndex,
		onChange,
	])

	return (
		<div className={cx(styles.branchListItem, "branch-list-item")}>
			<SourceHandle
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
