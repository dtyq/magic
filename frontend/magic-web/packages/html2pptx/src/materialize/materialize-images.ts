import type { ResourceLoadError } from "../api/options"
import type { PPTImageNode, PPTNode } from "../ir/node"
import { log, LogLevel } from "../logger"
import { withMediaSourceKey } from "../media/source-descriptor"

type ResourceErrorReporter = (error: ResourceLoadError) => void

export async function materializePptImageNodes(
	nodes: PPTNode[],
	signal?: AbortSignal,
	onResourceError?: ResourceErrorReporter,
): Promise<void> {
	const imageNodes = nodes.filter((n): n is PPTImageNode => n.type === "image")
	for (const node of imageNodes) {
		await materializePptImageNode(node, signal, onResourceError)
	}
	log(LogLevel.L2, `基础物化 ${imageNodes.length} 个图片节点完成`)
}

async function materializePptImageNode(
	node: PPTImageNode,
	_signal?: AbortSignal,
	onResourceError?: ResourceErrorReporter,
): Promise<void> {
	if (!node.source) {
		onResourceError?.({
			url: node.assetKey?.slice(0, 200) || "image",
			kind: "image",
			reason: "load-error",
		})
		throw new TypeError("Image node must provide a source descriptor")
	}
	node.source = withMediaSourceKey(node.source, node.assetKey)
	node.captureElement = undefined
}
