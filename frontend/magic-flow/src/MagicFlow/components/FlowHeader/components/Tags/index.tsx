import { prefix } from "@/MagicFlow/constants"
import { Tooltip } from "antd"
import clsx from "clsx"
import React from "react"
import styles from "../../index.module.less"

type TagsProps = {
	list?: (
		| {
				icon: React.JSX.Element
				text: string
		  }
		| {
				icon: null
				text: string
		  }
	)[]
}

export default function Tags({ list }: TagsProps) {
	return (
		<ul className={clsx(styles.tags, `${prefix}tags`)}>
			{list?.map?.((tag, i) => {
				return (
					<li className={clsx(styles.tag, `${prefix}tag`)} key={i}>
						{tag.icon}
						<Tooltip title={tag.text}>
							<span className={clsx(styles.tagText, `${prefix}tag-text`)}>
								{tag.text}
							</span>
						</Tooltip>
					</li>
				)
			})}
		</ul>
	)
}
