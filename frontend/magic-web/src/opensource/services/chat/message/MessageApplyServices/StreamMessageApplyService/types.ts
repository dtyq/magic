import type { StreamResponse } from "@/opensource/types/request"

export interface StreamMessageTask {
	status: "init" | "doing" | "done"
	tasks: StreamResponse[]
	triggeredRender: boolean
}
