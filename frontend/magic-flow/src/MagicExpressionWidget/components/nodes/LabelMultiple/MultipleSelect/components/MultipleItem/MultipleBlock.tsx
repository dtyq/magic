import { IconX } from "@tabler/icons-react"
import React from "react"
import { MultipleOption } from "../../../types"

type MultipleBlockProps = { item: MultipleOption; onDelete?: () => void }

export default function MultipleBlock({ item, onDelete }: MultipleBlockProps) {
	return (
		<div
			className="left"
			style={{
				backgroundColor: item.color,
			}}
		>
			<div className="text">
				<span className="text-content">{item.label}</span>
			</div>
			{onDelete && <IconX onClick={onDelete} size={14} className="iconX" />}
		</div>
	)
}
