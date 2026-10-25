import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@/pages/flow/components/JSONSchemaRenderer"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"

export type WidgetValue = {
	value: {
		widget: any
		form: {
			id: string
			version: string
			type: string
			structure: Schema
		}
	}
	title?: string
	wrapperClassName?: string
}

export default function Output({ value, title, wrapperClassName }: WidgetValue) {
	const { t } = useTranslation()
	return (
		<div className={cx(styles.output, wrapperClassName)}>
			<DropdownCard title={title ?? t("common.output", { ns: "flow" })}>
				{/* @ts-ignore */}
				<JSONSchemaRenderer form={value?.form?.structure} />
			</DropdownCard>
		</div>
	)
}
