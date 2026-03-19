import { transformDataToWorkbook } from "./utils-data"
import { TransformWorkerMessageType, type WorkerMessage, type WorkerResponse } from "./types"

self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
	const { type, payload } = event.data
	try {
		if (type === TransformWorkerMessageType.TRANSFORM_REQUEST) {
			const result = await transformDataToWorkbook(
				payload.data,
				payload.fileName,
				payload.isReadonly,
			)
			const response: WorkerResponse = {
				type: TransformWorkerMessageType.TRANSFORM_RESPONSE,
				payload: {
					id: payload.id,
					result,
				},
			}
			self.postMessage(response)
		}
	} catch (error) {
		const response: WorkerResponse = {
			type: TransformWorkerMessageType.TRANSFORM_ERROR,
			payload: {
				id: payload.id,
				error: {
					message: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				},
			},
		}
		self.postMessage(response)
	}
})
