import { useMemoizedFn } from "ahooks"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { OpenableProps } from "@/opensource/utils/react"
import MemberDepartmentSelector from "@/opensource/components/business/MemberDepartmentSelector"
import { TreeNode } from "@dtyq/user-selector"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export interface AddMemberModalProps {
	selected?: TreeNode[]
	onSubmit: (users: TreeNode[]) => void
	onClose?: () => void
}

export const AddMemberModal = ({
	selected,
	onSubmit,
	onClose,
}: OpenableProps<AddMemberModalProps>) => {
	const [open, setOpen] = useState(true)

	const onCancel = useMemoizedFn(() => {
		setOpen(false)
		onClose?.()
	})

	const { t } = useTranslation("interface")
	const [organizationChecked, setOrganizationChecked] = useState<TreeNode[]>([])

	const onOk = useMemoizedFn(async (data: TreeNode[]) => {
		if (data.length <= 0) {
			magicToast.warning(t("chat.groupSetting.addMember.PleaseSelectAtLeastOneMember"))
			throw new Error("请至少选择一个成员")
		}

		await onSubmit(data)
		onCancel?.()
	})

	useEffect(() => {
		if (selected?.length) {
			setOrganizationChecked(selected)
		}
	}, [selected])

	return (
		<MemberDepartmentSelector
			open={open}
			title={t("explore.form.addMemberOrDepartment")}
			onOk={onOk}
			onCancel={onCancel}
			selectedValues={organizationChecked}
			onSelectChange={setOrganizationChecked}
		/>
	)
}
