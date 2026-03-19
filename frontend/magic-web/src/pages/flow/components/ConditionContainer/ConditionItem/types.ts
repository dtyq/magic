import type { Sheet } from "@/types/sheet"
import type { Condition } from "../types"

export type ConditionItemProps = {
	handleDel: () => void
	onChange?: (val: Condition) => void
	value?: Condition
	isEnableDel?: boolean
	columns: Sheet.Content["columns"]
	isShowColumnOption?: boolean
	sheetId: string
	dataTemplate: Record<string, Sheet.Detail>
	isSupportRowId: boolean
}
