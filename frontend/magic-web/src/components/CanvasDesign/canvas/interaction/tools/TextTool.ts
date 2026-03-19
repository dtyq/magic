import Konva from "konva"
import { BaseTool, type ToolOptions } from "./BaseTool"
import { generateElementId } from "../../utils/utils"
import { TextElement as TextElementClass } from "../../element/elements/TextElement"
import type { TextElement } from "../../types"

/**
 * TextTool 配置接口
 */
export interface TextToolOptions extends ToolOptions {}

/**
 * 文本工具
 * 点击画布创建可编辑的文本输入框
 */
export class TextTool extends BaseTool {
	private textarea: HTMLTextAreaElement | null = null
	private textareaWrapper: HTMLDivElement | null = null
	private canvasX: number = 0
	private canvasY: number = 0
	private editingElementId: string | null = null
	private creatingElementId: string | null = null // 正在创建的新元素 ID

	constructor(options: TextToolOptions) {
		super(options)
	}

	/**
	 * 激活工具
	 */
	public activate(): void {
		this.isActive = true

		// 绑定点击事件
		this.canvas.stage.on("click", this.handleStageClick)
	}

	/**
	 * 停用工具
	 */
	public deactivate(): void {
		this.isActive = false

		// 解绑事件
		this.canvas.stage.off("click", this.handleStageClick)

		// 注意：不清理输入框，让用户可以继续输入
		// textarea 会在失焦时自动清理
	}

	/**
	 * 处理画布点击事件
	 */
	private handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>): void => {
		// 如果已经有输入框存在，不处理点击
		if (this.textarea) return

		// 如果点击在已有元素上，不创建新文本
		const target = e.target
		if (target !== this.canvas.stage) return

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) return

		// 转换为画布坐标（考虑视口缩放和平移）
		const transform = this.canvas.stage.getAbsoluteTransform().copy().invert()
		const canvasPos = transform.point(pos)

		// 清除所有选中状态
		this.canvas.selectionManager.deselectAll()

		// 保存画布坐标
		this.canvasX = canvasPos.x
		this.canvasY = canvasPos.y

		// 立即创建一个临时的文本元素
		const elementId = generateElementId()
		const newZIndex = this.canvas.elementManager.getNextZIndexInLevel()

		// 创建临时文本元素（空文本）
		const textElement = TextElementClass.createElementData(
			elementId,
			canvasPos.x,
			canvasPos.y,
			0,
			0,
			newZIndex,
			"", // 空文本
		)

		// 创建元素
		this.canvas.elementManager.create(textElement)

		// 选中元素（这样工具栏就会显示）
		this.canvas.selectionManager.selectMultiple([elementId])

		// 设置为编辑模式和创建阶段
		this.editingElementId = elementId
		this.creatingElementId = elementId // 标记这是正在创建的新元素

		// 创建文本输入框（编辑模式）
		this.createTextarea(canvasPos.x, canvasPos.y)

		// 创建文本输入框后立即切换回选择工具
		this.onTaskComplete()
	}

	/**
	 * 绑定视口变换事件
	 */
	private bindViewportEvents(): void {
		// 监听画布缩放和平移
		this.canvas.stage.on("wheel.textinput", this.handleViewportChange)
		this.canvas.stage.on("dragmove.textinput", this.handleViewportChange)
		this.canvas.stage.on("touchmove.textinput", this.handleViewportChange)
	}

	/**
	 * 解绑视口变换事件
	 */
	private unbindViewportEvents(): void {
		this.canvas.stage.off("wheel.textinput")
		this.canvas.stage.off("dragmove.textinput")
		this.canvas.stage.off("touchmove.textinput")
	}

	/**
	 * 处理视口变化（缩放、平移）
	 */
	private handleViewportChange = (): void => {
		if (!this.textarea || !this.textareaWrapper) return
		this.updateTextareaPosition()
	}

	/**
	 * 创建文本输入框
	 */
	private createTextarea(x: number, y: number): void {
		// 如果已经有输入框，先移除（但保留 editingElementId）
		const savedEditingId = this.editingElementId
		// 临时清空 editingElementId，防止 removeTextarea 恢复元素可见性
		this.editingElementId = null
		this.removeTextarea()
		// 恢复 editingElementId（如果之前在编辑模式）
		if (savedEditingId) {
			this.editingElementId = savedEditingId
		}

		// 获取当前视口的缩放和偏移
		const scale = this.canvas.stage.scaleX()
		const stagePos = this.canvas.stage.position()

		// 将画布坐标转换为屏幕坐标
		const screenX = x * scale + stagePos.x
		const screenY = y * scale + stagePos.y

		// 获取文本默认配置
		const defaultConfig = TextElementClass.getDefaultConfig()

		// 创建包装器
		this.textareaWrapper = document.createElement("div")
		this.textareaWrapper.style.position = "absolute"
		this.textareaWrapper.style.left = `${screenX}px`
		this.textareaWrapper.style.top = `${screenY}px`
		this.textareaWrapper.style.zIndex = "1000"

		// 创建 textarea
		this.textarea = document.createElement("textarea")
		// 移除所有默认样式
		this.textarea.style.border = "none"
		this.textarea.style.outline = "none"
		this.textarea.style.padding = "0"
		this.textarea.style.margin = "0"
		this.textarea.style.background = "transparent"
		this.textarea.style.resize = "none"
		this.textarea.style.overflow = "hidden"
		this.textarea.style.boxSizing = "content-box"
		// 应用与渲染元素一致的样式（考虑缩放）
		this.textarea.style.fontSize = `${(defaultConfig.fontSize as number) * scale}px`
		this.textarea.style.fontFamily = defaultConfig.fontFamily as string
		this.textarea.style.lineHeight = "1.5"
		this.textarea.style.color = defaultConfig.color as string
		this.textarea.style.whiteSpace = "pre"
		this.textarea.style.wordWrap = "normal"
		this.textarea.style.overflowWrap = "normal"
		// 设置初始尺寸
		this.textarea.style.width = "1px"
		this.textarea.style.height = "auto"
		this.textarea.rows = 1

		// 监听输入事件，自动调整大小
		this.textarea.addEventListener("input", this.handleTextareaInput)

		// 监听失焦事件
		this.textarea.addEventListener("blur", this.handleTextareaBlur)

		// 监听键盘事件
		this.textarea.addEventListener("keydown", this.handleTextareaKeydown)

		// 添加到包装器
		this.textareaWrapper.appendChild(this.textarea)

		// 添加到舞台容器
		this.canvas.stage.container().appendChild(this.textareaWrapper)

		// 延时200ms后自动聚焦
		setTimeout(() => {
			if (this.textarea) {
				this.textarea.focus()
			}
		}, 200)

		// 保存画布坐标，用于创建元素
		this.canvasX = x
		this.canvasY = y

		// 绑定视口事件，让输入框跟随画布变换
		this.bindViewportEvents()

		// 初始化尺寸
		this.updateTextareaSize()
	}

	/**
	 * 处理 textarea 输入事件
	 */
	private handleTextareaInput = (): void => {
		if (!this.textarea) return
		// 根据内容动态显示/隐藏边框
		if (this.textarea.value.trim()) {
			this.textarea.style.outline = "1px solid #3B82F6"
		} else {
			this.textarea.style.outline = "none"
		}
		this.updateTextareaSize()

		// 实时更新元素内容（如果是编辑模式）
		if (this.editingElementId) {
			const text = this.textarea.value
			const textareaWidth = this.textarea.offsetWidth
			const textareaHeight = this.textarea.offsetHeight
			const scale = this.canvas.stage.scaleX()
			const canvasWidth = textareaWidth / scale
			const canvasHeight = textareaHeight / scale

			this.updateTextElement(this.editingElementId, text, canvasWidth, canvasHeight)
		}
	}

	/**
	 * 更新 textarea 位置（跟随画布变换）
	 */
	private updateTextareaPosition(): void {
		if (!this.textarea || !this.textareaWrapper) return

		// 获取当前视口的缩放和偏移
		const scale = this.canvas.stage.scaleX()
		const stagePos = this.canvas.stage.position()

		// 将画布坐标转换为屏幕坐标
		const screenX = this.canvasX * scale + stagePos.x
		const screenY = this.canvasY * scale + stagePos.y

		// 更新位置
		this.textareaWrapper.style.left = `${screenX}px`
		this.textareaWrapper.style.top = `${screenY}px`

		// 更新字体大小以匹配缩放
		const defaultConfig = TextElementClass.getDefaultConfig()
		this.textarea.style.fontSize = `${(defaultConfig.fontSize as number) * scale}px`

		// 重新计算尺寸
		this.updateTextareaSize()
	}

	/**
	 * 更新 textarea 尺寸以适应内容
	 */
	private updateTextareaSize(): void {
		if (!this.textarea) return

		// 先设置一个很小的宽度，这样可以获取内容的实际宽度
		this.textarea.style.width = "1px"
		this.textarea.style.height = "auto"

		// 获取内容的实际尺寸
		const scrollWidth = this.textarea.scrollWidth
		const scrollHeight = this.textarea.scrollHeight

		// 设置最终尺寸（加一点余量避免滚动条）
		this.textarea.style.width = `${scrollWidth + 2}px`
		this.textarea.style.height = `${scrollHeight}px`
	}

	/**
	 * 处理 textarea 键盘事件
	 */
	private handleTextareaKeydown = (e: KeyboardEvent): void => {
		// 阻止事件冒泡，避免触发画布的快捷键
		e.stopPropagation()

		// Escape 键取消输入
		if (e.key === "Escape") {
			e.preventDefault()

			// 如果是创建阶段且内容为空，删除元素
			if (
				this.editingElementId &&
				this.creatingElementId === this.editingElementId &&
				!this.textarea?.value.trim()
			) {
				this.canvas.elementManager.delete(this.editingElementId)
			}

			// 清空状态
			this.editingElementId = null
			this.creatingElementId = null

			this.removeTextarea()
		}
	}

	/**
	 * 处理 textarea 失焦事件
	 */
	private handleTextareaBlur = (): void => {
		if (!this.textarea) return

		const text = this.textarea.value.trim()

		// 获取输入框的实际尺寸（屏幕坐标）
		const textareaWidth = this.textarea.offsetWidth
		const textareaHeight = this.textarea.offsetHeight

		// 获取当前缩放比例
		const scale = this.canvas.stage.scaleX()

		// 将屏幕尺寸转换为画布尺寸
		const canvasWidth = textareaWidth / scale
		const canvasHeight = textareaHeight / scale

		// 如果是编辑模式
		if (this.editingElementId) {
			const editingId = this.editingElementId
			const isCreating = this.creatingElementId === editingId

			// 先清空编辑状态，这样 removeTextarea 就不会尝试恢复元素
			this.editingElementId = null
			this.creatingElementId = null

			if (text) {
				// 已经在 input 事件中实时更新了，这里只需要确保最终状态正确
				// 创建新元素时已经选中，不需要重复选中；编辑已有元素时需要选中
				this.updateTextElement(editingId, text, canvasWidth, canvasHeight, !isCreating)
			} else {
				// 如果内容为空且处于创建阶段，删除元素
				if (isCreating) {
					this.canvas.elementManager.delete(editingId)
				} else {
					// 如果是编辑已有元素且内容为空，也删除元素
					this.canvas.elementManager.delete(editingId)
				}
			}
		}

		// 移除输入框
		this.removeTextarea()
	}

	/**
	 * 创建文本元素
	 */
	private createTextElement(
		text: string,
		x: number,
		y: number,
		width: number,
		height: number,
	): void {
		// 生成唯一 ID
		const elementId = generateElementId()

		// 获取下一个 zIndex（顶层元素的下一个 zIndex，因为新元素总是创建在顶层）
		const newZIndex = this.canvas.elementManager.getNextZIndexInLevel()

		// 使用 TextElementClass 创建文本元素数据
		const textElement = TextElementClass.createElementData(
			elementId,
			x,
			y,
			width,
			height,
			newZIndex,
			text,
		)

		// 创建元素
		this.canvas.elementManager.create(textElement)

		// 选中新创建的元素
		this.canvas.selectionManager.selectMultiple([elementId])
	}

	/**
	 * 更新文本元素
	 */
	private updateTextElement(
		elementId: string,
		text: string,
		width: number,
		height: number,
		shouldSelect: boolean = false,
	): void {
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!elementData || elementData.type !== "text") {
			return
		}

		const textElement = elementData as TextElement

		// 获取元素的当前位置（可能已被拖动）
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (element) {
			const pos = element.getPosition()
			textElement.x = pos.x
			textElement.y = pos.y
		}

		// 更新文本内容和尺寸
		textElement.content = [
			{
				children: [
					{
						type: "text",
						text,
					},
				],
				style: {
					textAlign: textElement.content?.[0]?.style?.textAlign || "left",
					lineHeight: textElement.content?.[0]?.style?.lineHeight || 1.5,
				},
			},
		]
		textElement.width = width
		textElement.height = height

		// 更新元素（会重新渲染节点）
		this.canvas.elementManager.update(textElement.id, textElement)

		// 仅在需要时选中元素
		if (shouldSelect) {
			this.canvas.selectionManager.selectMultiple([elementId])
		}
	}

	/**
	 * 移除文本输入框
	 */
	private removeTextarea(): void {
		// 如果是编辑模式，恢复原元素的可见性
		if (this.editingElementId) {
			const element = this.canvas.elementManager.getElementInstance(this.editingElementId)
			if (element) {
				element.setOpacity(1, { temporary: true })
			}
			this.editingElementId = null
		}

		// 解绑视口事件
		this.unbindViewportEvents()

		if (this.textarea) {
			this.textarea.removeEventListener("input", this.handleTextareaInput)
			this.textarea.removeEventListener("blur", this.handleTextareaBlur)
			this.textarea.removeEventListener("keydown", this.handleTextareaKeydown)
			this.textarea = null
		}

		if (this.textareaWrapper) {
			this.textareaWrapper.remove()
			this.textareaWrapper = null
		}
	}

	/**
	 * 编辑现有文本元素
	 */
	public editElement(elementId: string): void {
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!elementData || elementData.type !== "text") {
			return
		}

		const textElement = elementData as TextElement

		// 提取文本内容
		const text =
			textElement.content
				?.map((p) => p.children?.map((n) => n.text).join("") || "")
				.join("\n") || ""

		// 保存正在编辑的元素 ID（编辑已有元素，不是创建新元素）
		this.editingElementId = elementId
		this.creatingElementId = null // 不是创建新元素

		// 取消选中所有元素
		this.canvas.selectionManager.deselectAll()

		// 获取元素实例以获取实际位置
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			return
		}

		// 从元素获取实际位置（拖动后的位置）
		const pos = element.getPosition()
		this.canvasX = pos.x
		this.canvasY = pos.y

		// 隐藏原元素（通过设置透明度为 0，临时效果）
		element.setOpacity(0, { temporary: true })

		// 创建输入框并填充内容
		this.createTextarea(this.canvasX, this.canvasY)
		if (this.textarea) {
			this.textarea.value = text
			// 根据内容显示边框
			if (text.trim()) {
				this.textarea.style.outline = "1px solid #3B82F6"
			}
			// 选中所有文本
			this.textarea.select()
			// 更新尺寸
			this.updateTextareaSize()
		}
	}

	/**
	 * 获取工具元数据
	 */
	public getMetadata() {
		return {
			name: "Text Tool",
			cursor: "text" as const,
			isTemporary: false,
		}
	}

	/**
	 * 销毁工具
	 */
	public destroy(): void {
		this.deactivate()
	}
}
