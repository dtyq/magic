import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { getContents, getMainContent } from "../../document/elementContent"
import {
	ElementTypeEnum,
	type ImageElement,
	type ImageElementContent,
	type VideoElement,
	type VideoElementContent,
} from "../../document/types"
import {
	COLORS,
	IMAGE_CONFIG,
	LAYOUT,
	resolveImageControlCanvasOffset,
} from "../image/ImageElement.config"

type VersionedMediaElement = ImageElement | VideoElement

interface MediaVersionTagDecoratorConfig {
	canvas: Canvas
	width: number
	height: number
	data: VersionedMediaElement
}

/** 媒体主版本标识：仅展示当前内容是否为主版本，不提供版本操作。 */
// 图片另显示人工废稿状态，与主版本并列，不改变版本操作。
export class MediaVersionTagDecorator {
	private tag?: Konva.Group
	private viewportLayoutUnsubscribe?: () => void
	private transformHandler?: () => void
	private permissionChangedHandler?: () => void

	constructor(
		private readonly elementGroup: Konva.Group,
		private config: MediaVersionTagDecoratorConfig,
	) {}

	public create(): void {
		this.destroyTag()
		const label = this.getLabel()
		if (!label) return
		const discarded = this.isDiscarded()
		const iconSpace = discarded
			? IMAGE_CONFIG.INFO_ICON_SIZE + LAYOUT.DISCARDED_ICON_TEXT_GAP
			: 0
		const labelProbe = new Konva.Text({
			text: label,
			fontSize: LAYOUT.TEXT_FONT_SIZE,
			fontFamily: LAYOUT.TEXT_FONT_FAMILY,
			fontStyle: discarded ? "bold" : "normal",
		})
		const width = Math.ceil(labelProbe.getTextWidth() + LAYOUT.TEXT_PADDING_X * 2 + iconSpace)
		labelProbe.destroy()

		this.tag = new Konva.Group({
			width,
			height: IMAGE_CONFIG.INFO_BUTTON_SIZE,
			name: "decorator-media-main-version-tag",
			listening: false,
		})
		this.tag.add(
			new Konva.Rect({
				x: discarded ? 1 : 0,
				y: discarded ? 1 : 0,
				width: width - (discarded ? 2 : 0),
				height: IMAGE_CONFIG.INFO_BUTTON_SIZE - (discarded ? 2 : 0),
				cornerRadius: IMAGE_CONFIG.CORNER_RADIUS,
				fill: discarded ? COLORS.DISCARDED_TAG_BG : COLORS.BUTTON_BG,
				// 白描边放在标签尺寸内部，深色、浅色和复杂底图上都保留清楚的边界。
				stroke: discarded ? COLORS.DISCARDED_TAG_BORDER : undefined,
				strokeWidth: discarded ? 2 : 0,
				listening: false,
			}),
			new Konva.Text({
				x: LAYOUT.TEXT_PADDING_X + iconSpace,
				width: width - LAYOUT.TEXT_PADDING_X * 2 - iconSpace,
				height: IMAGE_CONFIG.INFO_BUTTON_SIZE,
				text: label,
				fontSize: LAYOUT.TEXT_FONT_SIZE,
				fontFamily: LAYOUT.TEXT_FONT_FAMILY,
				fontStyle: discarded ? "bold" : "normal",
				align: "center",
				verticalAlign: "middle",
				fill: "#FFFFFF",
				listening: false,
			}),
		)
		if (discarded) this.tag.add(this.createDiscardedIcon())

		this.elementGroup.add(this.tag)
		this.tag.moveToTop()
		this.updateLayout()
		this.setupListeners()
	}

	private createDiscardedIcon(): Konva.Group {
		const size = IMAGE_CONFIG.INFO_ICON_SIZE
		const icon = new Konva.Group({
			x: LAYOUT.TEXT_PADDING_X,
			y: (IMAGE_CONFIG.INFO_BUTTON_SIZE - size) / 2,
			scaleX: size / 24,
			scaleY: size / 24,
			listening: false,
		})
		// 与菜单的 Lucide ArchiveX 图形一致；同步绘制矢量，避免缩放模糊及异步图片闪现。
		icon.add(
			new Konva.Rect({
				x: 2,
				y: 3,
				width: 20,
				height: 5,
				cornerRadius: 1,
				stroke: COLORS.DISCARDED_TAG_BORDER,
				strokeWidth: 2,
				listening: false,
			}),
			new Konva.Path({
				data: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8 M9.5 17l5-5 M9.5 12l5 5",
				stroke: COLORS.DISCARDED_TAG_BORDER,
				strokeWidth: 2,
				lineCap: "round",
				lineJoin: "round",
				listening: false,
			}),
		)
		return icon
	}

	public updateConfig(config: Partial<MediaVersionTagDecoratorConfig>): void {
		this.config = { ...this.config, ...config }
		this.create()
	}

	public refreshLayout(): void {
		this.updateLayout()
	}

	public destroy(): void {
		this.destroyTag()
		this.viewportLayoutUnsubscribe?.()
		this.viewportLayoutUnsubscribe = undefined
		if (this.transformHandler) {
			this.elementGroup.off("transform", this.transformHandler)
			this.transformHandler = undefined
		}
		if (this.permissionChangedHandler) {
			this.config.canvas.eventEmitter.off("permission:changed", this.permissionChangedHandler)
			this.permissionChangedHandler = undefined
		}
	}

	private isDiscarded(): boolean {
		return (
			this.config.data.type === ElementTypeEnum.Image &&
			this.config.canvas.getEffectiveContent<ImageElementContent>(this.config.data.id)
				?.discarded === true
		)
	}

	private getLabel(): string {
		const labels: string[] = []
		if (this.shouldDisplayMainVersion()) {
			labels.push(
				this.config.canvas.t?.("elementBottomToolbar.mainVersion", {
					defaultValue: "主版本",
				}) ?? "主版本",
			)
		}
		if (this.isDiscarded()) {
			labels.push(
				this.config.canvas.t?.("elementBottomToolbar.discardedDraft", {
					defaultValue: "废稿",
				}) ?? "废稿",
			)
		}
		return labels.join(" · ")
	}

	private shouldDisplayMainVersion(): boolean {
		const contents = getContents(this.config.data)
		const activeContent = this.config.canvas.getEffectiveContent<
			ImageElementContent | VideoElementContent
		>(this.config.data.id)
		const mainContent = getMainContent(this.config.data)
		return (
			contents.length > 1 &&
			activeContent?.contentId !== undefined &&
			activeContent.contentId === mainContent?.contentId
		)
	}

	private updateLayout(options?: { requestDraw?: boolean }): void {
		if (!this.tag) return
		const stage = this.elementGroup.getStage()
		if (!stage) return
		const viewportScale = stage.scaleX()
		const elementScaleX = this.elementGroup.scaleX()
		const elementScaleY = this.elementGroup.scaleY()
		const totalScaleX = viewportScale * elementScaleX
		const totalScaleY = viewportScale * elementScaleY
		if (!Number.isFinite(totalScaleX) || !Number.isFinite(totalScaleY)) return
		if (!totalScaleX || !totalScaleY) return

		const elementScreenWidth = Math.abs(this.config.width * totalScaleX)
		const elementScreenHeight = Math.abs(this.config.height * totalScaleY)
		// 正常尺寸抵消画布缩放；废稿在小图上减少抵消，角标与边距一起缩小。
		const tagScale = this.isDiscarded()
			? Math.min(
					1,
					(elementScreenWidth * LAYOUT.DISCARDED_TAG_MAX_IMAGE_RATIO) / this.tag.width(),
					(elementScreenHeight * LAYOUT.DISCARDED_TAG_MAX_IMAGE_RATIO) /
						this.tag.height(),
				)
			: 1
		const offsetX = resolveImageControlCanvasOffset(totalScaleX) * tagScale
		const offsetY = resolveImageControlCanvasOffset(totalScaleY) * tagScale
		const offsetScreenX = offsetX * totalScaleX
		const offsetScreenY = offsetY * totalScaleY
		const tagScreenWidth = this.tag.width() * tagScale
		const tagScreenHeight = this.tag.height() * tagScale

		this.tag.scale({ x: tagScale / totalScaleX, y: tagScale / totalScaleY })
		this.tag.position({ x: offsetX, y: offsetY })
		this.tag.visible(
			tagScale > 0 &&
				elementScreenWidth >= tagScreenWidth + offsetScreenX * 2 &&
				elementScreenHeight >= tagScreenHeight + offsetScreenY * 2,
		)
		this.tag.opacity(this.config.canvas.permissionManager.can("document.write") ? 1 : 0.55)
		this.tag.moveToTop()
		if (options?.requestDraw !== false) {
			this.tag.getLayer()?.batchDraw()
		}
	}

	private setupListeners(): void {
		if (!this.viewportLayoutUnsubscribe) {
			// ViewportController 已为缩放帧请求整 Stage 绘制，这里只同步布局属性。
			this.viewportLayoutUnsubscribe =
				this.config.canvas.runtimeScheduler.registerViewportScaleLayout(
					this.config.data.id,
					() => this.updateLayout({ requestDraw: false }),
				)
		}
		if (!this.transformHandler) {
			this.transformHandler = () => this.updateLayout()
			this.elementGroup.on("transform", this.transformHandler)
		}
		if (!this.permissionChangedHandler) {
			this.permissionChangedHandler = () => this.updateLayout()
			this.config.canvas.eventEmitter.on("permission:changed", this.permissionChangedHandler)
		}
	}

	private destroyTag(): void {
		this.tag?.destroy()
		this.tag = undefined
	}
}
