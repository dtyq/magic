import type { Knowledge } from "@/types/knowledge"
import { useMemoizedFn } from "ahooks"
import { Switch } from "antd"
import { KnowledgeApi } from "@/apis"

type EnableCellProps = {
	enabled: boolean
	record: Knowledge.KnowledgeItem
	updateKnowledgeById: (id: string, keys: string[], value: any) => void
	disabled?: boolean
}

export default function EnableCell({
	enabled,
	record,
	updateKnowledgeById,
	disabled = false,
}: EnableCellProps) {
	const updateEnableStatus = useMemoizedFn(async (checked: boolean, event) => {
		event.stopPropagation()
		await KnowledgeApi.updateKnowledge({
			code: record.code,
			name: record.name,
			description: record.description,
			icon: record.icon,
			enabled: checked,
		})
		updateKnowledgeById(record.id, ["enabled"], checked)
	})

	return <Switch checked={enabled} onChange={updateEnableStatus} disabled={disabled} />
}
