import {
	IconAbc,
	IconArrowsExchange,
	IconArrowLeft,
	IconArrowRight,
	IconCalendar,
	IconCheck,
	IconCheckbox,
	IconCircle,
	IconCircleCheck,
	IconClick,
	IconCode,
	IconDots,
	IconHash,
	IconLink,
	IconLogin2,
	IconListCheck,
	IconMathFunction,
	IconNumber,
	IconPaperclip,
	IconPlus,
	IconSearch,
	IconTextPlus,
	IconTrash,
	IconUser,
	IconClock,
	type IconProps,
} from "@tabler/icons-react"
import React from "react"

const icons = {
	"ts-abc": IconAbc,
	"ts-add": IconPlus,
	"ts-arrow-left": IconArrowLeft,
	"ts-arrow-right": IconArrowRight,
	"ts-attachment": IconPaperclip,
	"ts-button": IconClick,
	"ts-check-line": IconCheck,
	"ts-checkbox": IconCheckbox,
	"ts-checkbox-radio": IconCircleCheck,
	"ts-code": IconCode,
	"ts-completion-time": IconClock,
	"ts-create-time": IconClock,
	"ts-created-by": IconUser,
	"ts-date": IconCalendar,
	"ts-formula-line": IconMathFunction,
	"ts-ID": IconHash,
	"ts-link": IconLink,
	"ts-lookup": IconSearch,
	"ts-modified-by": IconUser,
	"ts-modify-time": IconClock,
	"ts-multiline-text": IconTextPlus,
	"ts-multiple-choice": IconListCheck,
	"ts-number": IconNumber,
	"ts-more-dot": IconDots,
	"ts-one-way-link": IconLink,
	"ts-paperclip": IconPaperclip,
	"ts-trash": IconTrash,
	"ts-subtask": IconLogin2,
	"ts-two-wat-link": IconArrowsExchange,
	"ts-user": IconUser,
} as const

type TSIconProps = Omit<IconProps, "type"> & {
	type: string
}

export default function TSIcon({ type, ...props }: TSIconProps) {
	const Icon = icons[type as keyof typeof icons] ?? IconCircle
	return <Icon size={props.size ?? 18} {...props} />
}
