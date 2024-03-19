import { IconBrandOpenai, IconCheck } from "@tabler/icons-react"
import { createStyles, cx } from "antd-style"

import { Tooltip } from "antd"

export enum LLMLabelTagType {
	Text = 1,
	Icon = 2,
}

type LLMLabelProps = {
	label: string
	tags: Array<{
		type: LLMLabelTagType
		value: string
	}>
	value: string | number | boolean | null | undefined
	selectedValue: string | number | boolean | null | undefined
	showCheck?: boolean
	icon: string
}

const useStyles = createStyles(({ css, token }) => {
	return {
		LLMLabel: css`
			display: flex;
			align-items: center;
			flex: 1;
			padding-left: 8px;
		`,
		img: css`
			width: 18px;
			height: 18px;
			border-radius: 4px;
		`,
		title: css`
			line-height: 20px;
			color: ${token.colorText};
			font-size: 14px;
			margin-left: 6px;
			max-width: 60%;
			overflow: hidden;
			text-wrap: nowrap;
			text-overflow: ellipsis;
		`,
		tagList: css`
			margin-left: 4px;
			display: flex;
			align-items: center;
			list-style-type: none;
			gap: 4px;
			margin: 0;
			margin-left: 4px;
		`,
		tagItem: css`
			height: 20px;
			border-radius: 4px;
			border: 1px solid ${token.colorBorderSecondary};
			color: ${token.colorTextTertiary};
			font-size: 12px;
			line-height: 16px;
			min-width: 26px;
			display: flex;
			align-items: center;
			justify-content: center;

			svg {
				height: 14px;
				width: 14px;
			}
		`,
		iconItem: css`
			padding: 0 5px;
		`,
		textItem: css`
			padding: 0 7px;
		`,
		checked: css`
			position: absolute;
			right: 7px;
			width: 18px;
			height: 18px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.colorPrimary};
		`,
	}
})

export default function LLMLabel({
	label,
	tags,
	value,
	selectedValue,
	icon,
	showCheck = true,
}: LLMLabelProps) {
	const { styles } = useStyles()

	return (
		<Tooltip title={label}>
			<div className={styles.LLMLabel}>
				{icon ? (
					<img src={icon} alt="" className={styles.img} />
				) : (
					<IconBrandOpenai size={18} />
				)}
				<span className={styles.title}>{label}</span>
				<ul className={styles.tagList}>
					{tags.map((tag, index) => (
						<li
							key={index}
							className={cx(styles.tagItem, {
								[styles.textItem]: tag.type === LLMLabelTagType.Text,
								[styles.iconItem]: tag.type === LLMLabelTagType.Icon,
							})}
						>
							{tag.type === LLMLabelTagType.Icon ? null : <span>{tag.value}</span>}
						</li>
					))}
				</ul>

				{showCheck && selectedValue === value && <IconCheck className={styles.checked} />}
			</div>
		</Tooltip>
	)
}
