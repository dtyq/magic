import type { QuickInstruction } from "@/types/bot"
import { DisplayType } from "@/types/bot"

import { TFunction } from "i18next"

export const SYSTEM_DISPLAY_TYPE = "display_type"

export const DEFAULT_ICON = "IconWand"

// 是否是系统指令
export const isSystemItem = (item: QuickInstruction): boolean =>
	SYSTEM_DISPLAY_TYPE in item && item[SYSTEM_DISPLAY_TYPE] === DisplayType.SYSTEM

// 指令插入位置
export enum InsertLocationMap {
	// 前方
	Before = 1,
	// 光标处
	Cursor = 2,
	// 后方
	Behind = 3,
}

// 指令插入位置选项
export const INSERT_OPTIONS = (t: TFunction) => [
	{ value: InsertLocationMap.Before, label: t("explore.form.insertBefore") },
	{ value: InsertLocationMap.Cursor, label: t("explore.form.insertCursor") },
	{ value: InsertLocationMap.Behind, label: t("explore.form.insertBehind") },
]
