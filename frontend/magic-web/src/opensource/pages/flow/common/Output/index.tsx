import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@/opensource/pages/flow/components/JSONSchemaRenderer"
import { cx } from "antd-style"
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

export default function Output({ value, title = "输出", wrapperClassName }: WidgetValue) {
	return (
		<div className={cx(styles.output, wrapperClassName)}>
			<DropdownCard title={title}>
				{/* @ts-ignore */}
				<JSONSchemaRenderer form={value?.form?.structure} />
			</DropdownCard>
		</div>
	)
}
