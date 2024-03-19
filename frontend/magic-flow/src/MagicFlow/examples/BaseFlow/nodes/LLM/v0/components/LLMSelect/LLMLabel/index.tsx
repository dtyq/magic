import brandOpenApi from "@/common/assets/brand-openai.png"
import { IconCheck } from "@tabler/icons-react"
import clsx from "clsx"
import React from "react"
import styles from "./index.module.less"

export enum LLMLabelTagType {
	Text = 1,
	Icon = 2,
}

type LLMLabel = {
	label: string
	tags: Array<{
		type: LLMLabelTagType
		value: string
	}>
	value: string | number | boolean | null | undefined
	selectedValue: string | number | boolean | null | undefined
	showCheck?: boolean
}

export default function LLMLabel({
	label,
	tags,
	value,
	selectedValue,
	showCheck = true,
}: LLMLabel) {
	return (
		<div className={styles.LLMLabel}>
			<img src={brandOpenApi} alt="" className={styles.img} />
			<span className={styles.title}>{label}</span>
			<ul className={styles.tagList}>
				{tags.map((tag) => {
					return (
						<li
							className={clsx(styles.tagItem, {
								[styles.textItem]: tag.type === LLMLabelTagType.Text,
								[styles.iconItem]: tag.type === LLMLabelTagType.Icon,
							})}
						>
							{tag.type === LLMLabelTagType.Icon ? null : <span>{tag.value}</span>}
						</li>
					)
				})}
			</ul>

			{showCheck && selectedValue === value && <IconCheck className={styles.checked} />}
		</div>
	)
}
