import { VisibleRangeType } from "@/types/bot"
import type { RadioChangeEvent } from "antd"
import { Flex, Radio } from "antd"
import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import MagicButton from "@/components/base/MagicButton"
import { IconPlus, IconSitemap, IconX } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { openModal } from "@/utils/react"
import MagicAvatar from "@/components/base/MagicAvatar"
import MagicIcon from "@/components/base/MagicIcon"
import { AddMemberModal } from "@/pages/explore/components/PublishAgent/components/VisibleRange/AddMemberModal"
import { useStyles } from "@/pages/explore/components/PublishAgent/components/VisibleRange/style"
import { NodeType, TreeNode } from "@dtyq/user-selector"

interface VisibleRangeSelectorProps {
	type?: VisibleRangeType
	selected: TreeNode[]
	setSelected: React.Dispatch<React.SetStateAction<TreeNode[]>>
	onAddMemberStart?: () => void
	onAddMemberEnd?: () => void
	title?: string
	description?: string
	onTypeChange?: (type: VisibleRangeType) => void
}

/**
 * 独立的可见范围选择器组件，不依赖 Form.Item
 * 专门用于 AgentDesigner 等不使用 Form 的场景
 */
const VisibleRangeSelector = memo(
	({
		selected,
		setSelected,
		type,
		onAddMemberStart,
		onAddMemberEnd,
		title,
		description,
		onTypeChange,
	}: VisibleRangeSelectorProps) => {
		const { t } = useTranslation("interface")
		const { styles } = useStyles()

		const options = useMemo(
			() => [
				{
					value: VisibleRangeType.Unset,
					label: t("explore.form.onlyMe"),
				},
				{
					value: VisibleRangeType.AllMember,
					label: t("explore.form.allMember"),
				},
				{
					value: VisibleRangeType.SpecifiedMemberOrDepartment,
					label: t("explore.form.specificMember"),
				},
			],
			[t],
		)

		const onSubmitAddMember = useMemoizedFn((checked: TreeNode[]) => {
			setSelected(checked)
			onAddMemberEnd?.()
		})

		const handleAddMember = useMemoizedFn(() => {
			onAddMemberStart?.()

			openModal(AddMemberModal, {
				selected,
				onSubmit: onSubmitAddMember,
			})
		})

		const handleChange = useMemoizedFn((e: RadioChangeEvent) => {
			const newValue = e.target.value
			onTypeChange?.(newValue)

			// 切换到"仅自己可见"或"全员可见"时，清空已选成员
			if (newValue === VisibleRangeType.Unset || newValue === VisibleRangeType.AllMember) {
				setSelected([])
			}
		})

		const handleRemove = (id: string) => {
			setSelected((prev) => prev.filter((item) => item.id !== id))
		}

		const getUserItem = useMemoizedFn((item: TreeNode) => {
			switch (item.dataType) {
				case NodeType.User:
					return (
						<>
							<MagicAvatar src={item.avatar_url} size={18}>
								{item.nickname}
							</MagicAvatar>
							<div>{item.nickname || ""}</div>
						</>
					)
				case NodeType.Department:
					return (
						<>
							<MagicIcon
								color="currentColor"
								component={IconSitemap}
								size={18}
								className={styles.departmentIcon}
							/>
							<div>{item.name || ""}</div>
						</>
					)
				default:
					return null
			}
		})

		return (
			<Flex vertical gap={10}>
				<Flex vertical>
					<div className={styles.title}>{title || t("explore.form.visibleRange")}</div>
					<div className={styles.desc}>
						{description || t("explore.form.visibleRangeDesc")}
					</div>
				</Flex>
				<Radio.Group value={type} options={options} onChange={handleChange} />
				{type === VisibleRangeType.SpecifiedMemberOrDepartment && (
					<div className={styles.member}>
						<MagicButton
							icon={<IconPlus size={20} />}
							type="primary"
							ghost
							onClick={handleAddMember}
						>
							{t("explore.form.addMemberOrDepartment")}
						</MagicButton>
						<Flex gap={8} className={styles.memberList}>
							{selected.map((item, index) => (
								<Flex
									gap={4}
									key={`${item.id}-${index}`}
									className={styles.memberItem}
									align="center"
								>
									{getUserItem(item)}
									<MagicIcon
										component={IconX}
										size={16}
										onClick={() => handleRemove(item.id)}
									/>
								</Flex>
							))}
						</Flex>
					</div>
				)}
			</Flex>
		)
	},
)

export default VisibleRangeSelector
