import type { StreamResponse } from "@/types/request"

export interface StreamMessageTask {
	status: "init" | "doing" | "done"
	tasks: StreamResponse[]
	triggeredRender: boolean
}
