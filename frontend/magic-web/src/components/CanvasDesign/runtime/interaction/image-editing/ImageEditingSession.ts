import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import type { CanvasEvent } from "../../core/EventEmitter"
import { ElementTypeEnum } from "../../document/types"
import {
	getLocalRectRelativeTo,
	syncNodeTransformRelativeTo,
} from "../../shared/geometry/nodeTransform"

const IMAGE_EDITING_PROXY_GROUP_NAME = "image-editing-proxy"

/**
 * 管理图片特殊编辑期间的临时可视代理与原图显隐。
 *
 * 文档父子关系和真实 Konva 父级均保持不变，避免 Frame children、zIndex、
 * rerender 父级和持久化状态被临时编辑污染。
 */
export class ImageEditingSession {
	private readonly canvas: Canvas
	private readonly elementId: string
	private sourceNode: Konva.Group | null = null
	private proxyGroup: Konva.Group | null = null
	private proxyImage: Konva.Image | null = null
	private sourceVisibleBeforeEditing = true
	private mounted = false
	private destroyed = false
	private elementRerenderedHandler?: (event: { data: { elementId: string } }) => void
	private resourceWillCloseHandler?: (event: CanvasEvent<"resource:image:will-close">) => void
	private readonly closedImages = new WeakSet<object>()

	constructor(options: { canvas: Canvas; elementId: string }) {
		this.canvas = options.canvas
		this.elementId = options.elementId
	}

	public mount(): boolean {
		if (this.mounted) return true
		if (this.destroyed) return false

		const sourceNode = this.resolveSourceNode()
		const renderedImageNode = sourceNode ? this.findRenderedImageNode(sourceNode) : null
		const renderedImage = renderedImageNode?.image()
		if (!sourceNode || !renderedImageNode || !renderedImage) return false

		const width = sourceNode.width()
		const height = sourceNode.height()
		if (width <= 0 || height <= 0) return false

		this.sourceNode = sourceNode
		this.sourceVisibleBeforeEditing = sourceNode.visible()
		this.proxyGroup = new Konva.Group({
			width,
			height,
			name: IMAGE_EDITING_PROXY_GROUP_NAME,
			listening: false,
			clipFunc: (ctx) => ctx.rect(0, 0, width, height),
		})
		this.proxyImage = renderedImageNode.clone({ listening: false })
		this.proxyGroup.add(this.proxyImage)
		this.canvas.controlsLayer.add(this.proxyGroup)
		this.syncFromSource()

		this.resourceWillCloseHandler = ({ data }) => {
			this.closedImages.add(data.image)
			if (this.proxyImage?.image() !== data.image) return
			this.proxyImage.image(undefined)
			this.canvas.controlsLayer.batchDraw()
			queueMicrotask(() => {
				if (this.destroyed) return
				this.syncFromSource()
			})
		}
		this.canvas.eventEmitter.on("resource:image:will-close", this.resourceWillCloseHandler)

		this.elementRerenderedHandler = ({ data }) => {
			if (data.elementId !== this.elementId || this.destroyed) return
			this.rebindAfterRerender()
		}
		this.canvas.eventEmitter.on("element:rerendered", this.elementRerenderedHandler)

		// 代理已经完整挂载并同步后才隐藏原图，保证失败路径不出现空白。
		sourceNode.visible(false)
		this.mounted = true
		sourceNode.getLayer()?.batchDraw()
		this.canvas.controlsLayer.batchDraw()
		return true
	}

	public syncFromSource(): void {
		if (!this.sourceNode || !this.proxyGroup) return

		const width = this.sourceNode.width()
		const height = this.sourceNode.height()
		this.proxyGroup.setAttrs({
			width,
			height,
			opacity: this.sourceNode.getAbsoluteOpacity(),
			clipFunc: (ctx: Konva.Context) => ctx.rect(0, 0, width, height),
		})
		syncNodeTransformRelativeTo(this.sourceNode, this.proxyGroup, this.canvas.controlsLayer)

		const renderedImageNode = this.findRenderedImageNode(this.sourceNode)
		const renderedImage = renderedImageNode?.image()
		if (renderedImage && !this.closedImages.has(renderedImage) && this.proxyImage) {
			this.proxyImage.setAttrs({
				image: renderedImage,
				x: renderedImageNode.x(),
				y: renderedImageNode.y(),
				width: renderedImageNode.width(),
				height: renderedImageNode.height(),
				crop: renderedImageNode.crop(),
			})
		}
		this.canvas.controlsLayer.batchDraw()
	}

	public getSourceNode(): Konva.Group | null {
		return this.sourceNode
	}

	public getProxyGroup(): Konva.Group | null {
		return this.proxyGroup
	}

	public getContentBounds(): { x: number; y: number; width: number; height: number } | null {
		if (!this.proxyGroup) return null
		return getLocalRectRelativeTo(this.proxyGroup, this.canvas.contentLayer, {
			x: 0,
			y: 0,
			width: this.proxyGroup.width(),
			height: this.proxyGroup.height(),
		})
	}

	public destroy(): void {
		if (this.destroyed) return
		this.destroyed = true

		if (this.elementRerenderedHandler) {
			this.canvas.eventEmitter.off("element:rerendered", this.elementRerenderedHandler)
			this.elementRerenderedHandler = undefined
		}
		if (this.resourceWillCloseHandler) {
			this.canvas.eventEmitter.off("resource:image:will-close", this.resourceWillCloseHandler)
			this.resourceWillCloseHandler = undefined
		}

		const sourceNode = this.resolveSourceNode() ?? this.sourceNode
		if (sourceNode) {
			sourceNode.visible(this.sourceVisibleBeforeEditing)
			sourceNode.getLayer()?.batchDraw()
		}

		this.proxyGroup?.destroy()
		this.proxyGroup = null
		this.proxyImage = null
		this.sourceNode = null
		this.canvas.controlsLayer.batchDraw()
	}

	private rebindAfterRerender(): void {
		const sourceNode = this.resolveSourceNode()
		if (!sourceNode) return

		this.sourceNode = sourceNode
		sourceNode.visible(false)
		this.syncFromSource()
		sourceNode.getLayer()?.batchDraw()
	}

	private resolveSourceNode(): Konva.Group | null {
		const elementData = this.canvas.elementManager.getElementData(this.elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) return null
		const node = this.canvas.elementManager.getElementInstance(this.elementId)?.getNode()
		return node instanceof Konva.Group ? node : null
	}

	private findRenderedImageNode(sourceNode: Konva.Group): Konva.Image | null {
		const imageNode = sourceNode.findOne((node: Konva.Node) => {
			const image = node instanceof Konva.Image ? node.image() : undefined
			return node instanceof Konva.Image && !!image && !this.closedImages.has(image as object)
		})
		return imageNode instanceof Konva.Image ? imageNode : null
	}
}
