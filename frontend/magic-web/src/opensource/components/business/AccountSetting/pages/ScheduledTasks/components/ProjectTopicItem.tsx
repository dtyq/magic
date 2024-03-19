import { Form, Flex } from "antd"
import { get } from "lodash-es"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import { MagicSwitch } from "@/opensource/components/base/MagicSwitch"
import { useModifyStyles } from "../styles"
import SelectItem, { type OptionItem } from "./SelectItem"

interface ProjectTopicItemProps {
	mode: "project" | "topic"
	workspaceId: string
	projectId?: string
	onSelect?: (value: OptionItem | undefined) => void
}

function ProjectTopicItem({ mode, workspaceId, projectId, onSelect }: ProjectTopicItemProps) {
	const { t } = useTranslation("interface")
	const { styles } = useModifyStyles()

	return (
		<Form.Item
			label={
				<Flex gap={4} align="center">
					{t(`accountPanel.timedTasks.${mode}`)}
					<Form.Item
						name={`${mode}_enabled`}
						noStyle
						valuePropName="checked"
						initialValue={true}
					>
						<MagicSwitch size="small" />
					</Form.Item>
				</Flex>
			}
		>
			<Form.Item
				noStyle
				shouldUpdate={(prevValues, currentValues) => {
					const prevValue = get(prevValues, `${mode}_enabled`)
					const currentValue = get(currentValues, `${mode}_enabled`)
					return prevValue !== currentValue
				}}
			>
				{({ getFieldValue }) => {
					const isEnabled = getFieldValue(`${mode}_enabled`)

					return isEnabled ? (
						<Form.Item
							name={`${mode}_id`}
							rules={[
								{
									required: true,
									message: resolveToString(t("form.required"), {
										label: t(`accountPanel.timedTasks.${mode}`),
									}),
								},
							]}
						>
							<SelectItem
								type={mode}
								workspaceId={workspaceId}
								projectId={projectId}
								onSelect={onSelect}
							/>
						</Form.Item>
					) : (
						<span className={styles.desc}>
							{t(`accountPanel.timedTasks.${mode}Description`)}
						</span>
					)
				}}
			</Form.Item>
		</Form.Item>
	)
}

export default ProjectTopicItem
