/**
 * Tools参数配置器
 */
import type { FormListFieldData } from "antd"
import { Form, Switch, Tooltip, Flex } from "antd"
import { IconHelp } from "@tabler/icons-react"
import MagicJSONSchemaEditorWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicJsonSchemaEditorWrap"
import usePrevious from "@/opensource/pages/flow/common/hooks/usePrevious"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import { DisabledField } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"
import useToolsParameters from "./hooks/useToolsParameters"

type ToolsParametersProps = {
	field: FormListFieldData
}

export default function ToolsParameters({ field }: ToolsParametersProps) {
	const { t } = useTranslation()
	const { asyncCall } = useToolsParameters()

	const { expressionDataSource } = usePrevious()

	return (
		<div className={styles.panel} onClick={(e) => e.stopPropagation()}>
			<div className={styles.header}>
				<span className={styles.h1Title}>{t("common.toolsSettings", { ns: "flow" })}</span>
			</div>
			<div className={styles.body}>
				<Flex className={styles.parameters} align="center">
					<div className={styles.left}>
						<span className={styles.title}>{asyncCall.label}</span>
						<Tooltip title={asyncCall.tooltips}>
							<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
						</Tooltip>
					</div>
					<Form.Item name={[field.name, "async"]} valuePropName="checked">
						<Switch />
					</Form.Item>
				</Flex>
				<div className={styles.label}>{t("common.customSystemInput", { ns: "flow" })}</div>
				<Form.Item name={[field.name, "custom_system_input", "form"]}>
					<MagicJSONSchemaEditorWrap
						allowExpression
						expressionSource={expressionDataSource}
						displayColumns={[ShowColumns.Key, ShowColumns.Type, ShowColumns.Value]}
						showImport={false}
						disableFields={[DisabledField.Name, DisabledField.Type]}
						allowAdd={false}
						oneChildAtLeast={false}
						showAdd={false}
						allowOperation={false}
					/>
				</Form.Item>
			</div>
		</div>
	)
}
