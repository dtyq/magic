import { useDeepCompareEffect, useMemoizedFn } from "ahooks"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import MemberDepartmentSelector from "@/components/business/MemberDepartmentSelector"
import { contactStore } from "@/stores/contact"
import type { MagicModalProps } from "@/components/base/MagicModal"
import { ChatApi } from "@/apis"
import { NodeType, TreeNode } from "@dtyq/user-selector"
import { observer } from "mobx-react-lite"
import { useIsMobile } from "@/hooks/useIsMobile"
import MobileMemberDepartmentSelector from "@/components/business/MobileMemberDepartmentSelector"
import magicToast from "@/components/base/MagicToaster/utils"

interface AddGroupMemberModalProps extends MagicModalProps {
	groupId: string
	extraUserIds?: string[]
	onClose: () => void
	onSubmit: (typeof ChatApi)["addGroupUsers"]
}

const AddGroupMemberModal = observer((props: AddGroupMemberModalProps) => {
	const isMobile = useIsMobile()
	const { t } = useTranslation("interface")

	const { open, onClose: onCloseInProps, extraUserIds = [], groupId, onSubmit } = props

	const [organizationChecked, setOrganizationChecked] = useState<TreeNode[]>([])

	const [disabledValues, setDisabledValues] = useState<TreeNode[]>([])
	useDeepCompareEffect(() => {
		if (extraUserIds.length > 0) {
			contactStore
				.getUsersInfo({
					user_ids: extraUserIds,
					query_type: 2,
				})
				.then((res) => {
					setDisabledValues(
						res.map((item) => ({
							...item,
							name: item.real_name,
							id: item.user_id,
							dataType: NodeType.User,
						})) as TreeNode[],
					)
				})
		} else {
			setDisabledValues([])
		}
	}, [extraUserIds])

	const onClose = useMemoizedFn(() => {
		onCloseInProps?.()
		setOrganizationChecked([])
	})

	const onOk = useMemoizedFn((data: TreeNode[]) => {
		if (!groupId) {
			throw new Error("groupId is required")
		}

		if (data.length <= 0) {
			magicToast.warning(t("chat.groupSetting.addMember.PleaseSelectAtLeastOneMember"))
			throw new Error("Please select at least one member")
		}
		const userIds = data
			.filter((item) => item.dataType === NodeType.User)
			.map((item) => item.id)
		const departmentIds = data
			.filter((item) => item.dataType === NodeType.Department)
			.map((item) => item.id)
		onSubmit?.({
			group_id: groupId,
			user_ids: userIds,
			department_ids: departmentIds,
		}).then(() => {
			onClose()
		})
	})

	const onCancel = useMemoizedFn(() => {
		onClose()
	})

	const commonProps = {
		disabledValues,
		selectedValues: organizationChecked,
		isConvertToUser: true,
		onSelectChange: setOrganizationChecked,
		onOk,
		onCancel,
	}

	return isMobile ? (
		<MobileMemberDepartmentSelector visible={open} {...commonProps} />
	) : (
		<MemberDepartmentSelector open={open} {...commonProps} />
	)
})

export default AddGroupMemberModal
