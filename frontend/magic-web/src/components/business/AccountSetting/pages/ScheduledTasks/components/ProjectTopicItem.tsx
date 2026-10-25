import { Form, Flex } from "antd"
import { get } from "lodash-es"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import { useModifyStyles } from "../styles"
import { FormSwitch } from "./FormSwitch"
import SelectItem, { type OptionItem } from "./SelectItem"

interface ProjectTopicItemProps {
	mode: "project" | "topic"
	workspaceId: string
	projectId?: string
	autoSelectFirstOption?: boolean
	onSelect?: (value: OptionItem | undefined) => void
}

/** Renders the optional project/topic form field with shared selection behavior. */
function ProjectTopicItem({
	mode,
	workspaceId,
	projectId,
	autoSelectFirstOption = false,
	onSelect,
}: ProjectTopicItemProps) {
	const { t } = useTranslation("interface")
	const { styles } = useModifyStyles()

	return (
		<Form.Item
			label={
				<Flex gap={4} align="center">
					{t(`accountPanel.timedTasks.${mode}`)}
					<Form.Item name={`${mode}_enabled`} noStyle valuePropName="checked">
						<FormSwitch />
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
								autoSelectFirstOption={autoSelectFirstOption}
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
