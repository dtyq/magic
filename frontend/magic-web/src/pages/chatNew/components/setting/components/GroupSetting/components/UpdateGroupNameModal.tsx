import type { MagicModalProps } from "@/components/base/MagicModal"
import MagicModal from "@/components/base/MagicModal"
import type { OpenableProps } from "@/utils/react"
import { useMemoizedFn } from "ahooks"
import { Input } from "antd"
import { memo, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

export interface UpdateGroupNameModalProps extends MagicModalProps {
	initialGroupName?: string
	conversationId: string
	onSave?: (groupName: string) => Promise<void>
}

const UpdateGroupNameModal = memo((props: OpenableProps<UpdateGroupNameModalProps>) => {
	const { open, initialGroupName, onClose, onSave } = props

	const [groupName, setGroupName] = useState(initialGroupName ?? "")

	useEffect(() => {
		if (open) {
			setGroupName(initialGroupName ?? "")
		}
	}, [open])

	const { t } = useTranslation("interface")

	const close = useMemoizedFn(() => {
		onClose?.()
	})

	const onOk = useMemoizedFn(() => {
		onSave?.(groupName).finally(() => {
			close()
		})
	})

	const onCancel = useMemoizedFn(() => {
		close()
	})

	return (
		<MagicModal
			width={400}
			title={t("chat.groupSetting.updateGroupName")}
			open={open}
			onOk={onOk}
			centered
			onCancel={onCancel}
			okText={t("common.save")}
		>
			<Input
				placeholder={t("chat.groupSetting.groupNamePlaceholder")}
				value={groupName}
				showCount
				maxLength={50}
				onChange={(e) => setGroupName(e.target.value)}
			/>
		</MagicModal>
	)
})

UpdateGroupNameModal.displayName = "UpdateGroupNameModal"

export default UpdateGroupNameModal
