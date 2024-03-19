import { useMemoizedFn, useUpdateEffect } from "ahooks"
import MagicModal from "@/opensource/components/base/MagicModal"
import { Form, Input } from "antd"
import { useTranslation } from "react-i18next"
import { memo, useState } from "react"

const MAX_NAME_LENGTH = 100

const RenameModal = memo(
	({
		initialValue,
		open,
		onClose,
		onOk,
	}: {
		initialValue: string
		open: boolean
		onClose: () => void
		onOk: (value: string) => void
	}) => {
		const { t } = useTranslation("interface")
		const [renameTopicValue, setRenameTopicValue] = useState(initialValue)

		const handleOk = useMemoizedFn(() => {
			onOk(renameTopicValue)
		})

		useUpdateEffect(() => {
			setRenameTopicValue(initialValue)
		}, [initialValue])

		return (
			<MagicModal
				width={400}
				title={t("chat.topic.menu.rename_topic")}
				open={open}
				onCancel={onClose}
				onOk={handleOk}
				centered
			>
				<Form.Item label={t("chat.topic.menu.topicName")}>
					<Input
						value={renameTopicValue}
						onChange={(e) =>
							setRenameTopicValue(e.target.value.slice(0, MAX_NAME_LENGTH))
						}
						maxLength={MAX_NAME_LENGTH}
						showCount
					/>
				</Form.Item>
			</MagicModal>
		)
	},
)

export default RenameModal
