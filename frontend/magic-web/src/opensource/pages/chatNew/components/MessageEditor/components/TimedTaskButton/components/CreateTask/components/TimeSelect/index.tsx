import { Form, TimePicker } from "antd"
import { memo } from "react"
import { IconClockFilled } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

export const TimeSelect = memo(({ width = 100 }: { width?: number }) => {
	const { t } = useTranslation("interface")

	return (
		<Form.Item
			noStyle
			name="time"
			rules={[{ required: true, message: t("chat.timedTask.timePlaceholder") }]}
		>
			<TimePicker
				style={{ width: `${width}%` }}
				suffixIcon={<IconClockFilled size={16} color="currentColor" />}
			/>
		</Form.Item>
	)
})
