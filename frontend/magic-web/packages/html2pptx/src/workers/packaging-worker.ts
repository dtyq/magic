import {
	createStreamingPackagingWorkerHandler,
	type PackagingWorkerPort,
} from "../packaging/streaming-worker-handler"
import type { StreamingPackagingWorkerRequest } from "../packaging/streaming-types"

/**
 * Worker entrypoint. The handler keeps sink ACK and abort messages out of the
 * serialized request queue so backpressure cannot deadlock an in-flight slide.
 */
export function installPackagingWorker(scope: Worker = self as unknown as Worker): void {
	const port: PackagingWorkerPort = {
		postMessage(message, transfer) {
			scope.postMessage(message, transfer ?? [])
		},
	}
	const handler = createStreamingPackagingWorkerHandler({
		postMessage: port.postMessage,
	})
	scope.onmessage = (event: MessageEvent<StreamingPackagingWorkerRequest>) => {
		handler.handle(event.data)
	}
}

if (typeof self !== "undefined") installPackagingWorker()
