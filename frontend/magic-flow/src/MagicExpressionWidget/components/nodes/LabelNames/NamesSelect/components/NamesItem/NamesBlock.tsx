import { IconX } from "@tabler/icons-react"
import React from "react"
import { NamesOption } from "../../../types"

type NamesBlockProps = { item: NamesOption; onDelete?: () => void; suffix?: any }

export default function NamesBlock({ item, onDelete, suffix }: NamesBlockProps) {
	return (
		<div className="left">
			<div className="text">{item.label}</div>
			{suffix}
			{onDelete && <IconX onClick={onDelete} size={14} className="iconX" />}
		</div>
	)
}
