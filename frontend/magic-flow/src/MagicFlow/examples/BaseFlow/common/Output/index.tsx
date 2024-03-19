import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@/common/BaseUI/JSONSchemaRenderer"
import React from "react"
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
}

export default function Output({ value, title = "输出" }: WidgetValue) {
	return (
		<div className={styles.output}>
			<DropdownCard title={title}>
				{/* @ts-ignore */}
				<JSONSchemaRenderer form={value?.form?.structure} />
			</DropdownCard>
		</div>
	)
}
