import { StructureItemType } from "@/types/organization"
import { useMemoizedFn, useMount } from "ahooks"
import { message } from "antd"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type {
	OrganizationSelectItem,
	SelectedResult,
	UserSelectItem,
} from "@/opensource/components/business/MemberDepartmentSelectPanel/types"
import MemberDepartmentSelectPanel from "@/opensource/components/business/MemberDepartmentSelectPanel"
import type { MagicModalProps } from "@/opensource/components/base/MagicModal"
import { ChatApi } from "@/apis"
import { observer } from "mobx-react-lite"
import { contactStore } from "@/opensource/stores/contact"

interface AddGroupMemberModalProps extends MagicModalProps {
	groupId: string
	extraUserIds?: string[]
	onClose: () => void
	onSubmit: (typeof ChatApi)["addGroupUsers"]
}

const AddGroupMemberModal = observer((props: AddGroupMemberModalProps) => {
	const { t } = useTranslation("interface")

	const { open, onClose: onCloseInProps, extraUserIds = [], groupId, onSubmit } = props

	const [organizationChecked, setOrganizationChecked] = useState<OrganizationSelectItem[]>([])

	const [disabledValues, setDisabledValues] = useState<any[]>([])
	useMount(() => {
		if (extraUserIds.length > 0) {
			contactStore
				.getUserInfos({
					user_ids: extraUserIds,
					query_type: 2,
				})
				.then((res) => {
					setDisabledValues(
						res.map((item) => ({
							...item,
							name: item.real_name,
							id: item.user_id,
							dataType: StructureItemType.User,
						})) as UserSelectItem[],
					)
				})
		}
	})

	const onClose = useMemoizedFn(() => {
		onCloseInProps?.()
	})

	const selectedCount = useMemo(() => {
		return organizationChecked.reduce((acc, curr) => {
			if (curr.dataType === StructureItemType.Department) {
				return acc + 1
			}
			return acc + 1
		}, 0)
	}, [organizationChecked])

	const onOk = useMemoizedFn((data: SelectedResult) => {
		if (!groupId) {
			return
		}
		if (selectedCount <= 0) {
			message.warning(t("chat.groupSetting.addMember.PleaseSelectAtLeastOneMember"))
			return
		}
		const userIds = data.user.map((item) => item.id)
		const departmentIds = data.department.map((item) => item.id)

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

	return (
		<MemberDepartmentSelectPanel
			open={open}
			disabledValues={disabledValues}
			selectValue={organizationChecked}
			onSelectChange={setOrganizationChecked}
			onOk={onOk}
			onCancel={onCancel}
			withoutGroup={true}
			filterResult={(result) => {
				return result.filter((item: any) => {
					return !item.ai_code
				})
			}}
		/>
	)
})

export default AddGroupMemberModal
