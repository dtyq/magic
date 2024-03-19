import { getColor } from "@/MagicExpressionWidget/utils"
import TsAvatar from "@/common/BaseUI/Avatar"
import { IconX } from "@tabler/icons-react"
import React from "react"
import { Member } from "../../../types"

type MemberBlockProps = { item: Member; size: number; onDelete?: () => void }

export default function MemberBlock({ item, size, onDelete }: MemberBlockProps) {
	const { name, real_name: realName, avatar } = item
	const { backgroundColor, textColor } = getColor(name || realName)
	return (
		<div
			className="left"
			style={{
				backgroundColor: backgroundColor,
				color: textColor,
			}}
		>
			<TsAvatar size={size} src={avatar} alt={name || realName} />
			<div className="text">
				<span className="text-content">{name || realName}</span>
			</div>
			{onDelete && <IconX onClick={onDelete} size={14} className="iconX" />}
		</div>
	)
}
