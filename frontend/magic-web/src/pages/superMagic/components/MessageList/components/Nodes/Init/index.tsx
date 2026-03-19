import type { NodeProps } from "../types"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import { ToolIconBadge } from "../../shared/ToolIconConfig"

function Init(props: NodeProps) {
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const { data } = tool?.detail || {}

	return (
		<div className="h-fit w-full flex-none pr-[5px]">
			<div className="inline-flex h-7 w-fit items-center gap-1.5 overflow-hidden rounded-md border border-border bg-white px-1.5 shadow-sm dark:bg-card">
				<ToolIconBadge toolName="init_virtual_machine" />
				<span className="w-fit flex-none whitespace-nowrap text-xs font-normal leading-4 text-foreground">
					{tool?.action}
				</span>
				<div className="min-w-0 truncate whitespace-nowrap text-xs leading-5 text-foreground/35">
					{data?.file_name}
				</div>
			</div>
		</div>
	)
}

export default observer(Init)
