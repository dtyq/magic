import type { Canvas } from "./Canvas"
import { ElementTypeEnum, type ElementType, type LayerElement } from "../document/types"
import {
	CanvasAccessPolicy,
	type CanvasAccessUpdate,
	type CanvasAuthorizationResult,
	type CanvasToolAuthorizationDefinition,
} from "./CanvasAccessPolicy"
import type { CanvasAccessContext, CanvasAccessMode, CanvasCapability } from "../../public/props"

const NON_CONNECTABLE_ELEMENT_TYPES = new Set<ElementType>([ElementTypeEnum.Group])

/**
 * 权限管理器 - 统一管理元素的交互权限
 *
 * 职责：
 * 1. 按 CanvasAccessContext 管理画布级文档能力
 * 2. 统一判断元素的可见性（visible）
 * 3. 统一判断元素的锁定状态（locked）
 * 4. 提供统一的元素交互性判断方法
 *
 * 权限判断规则：
 * - document.write / document.delete（画布级别）：影响所有文档变更交互
 * - locked（元素级别）：影响单个元素的交互
 * - visible（元素级别）：影响单个元素的可见性和交互
 *
 * 三者关系：
 * - 只要满足任一限制条件，元素就不可交互
 * - 画布能力优先级最高（画布级别）
 * - locked 和 visible 是元素级别的限制
 *
 * 限制说明：
 * - ❌ 不可见元素（visible === false）：不显示、不能 hover、不能选中；几何操作仍保留其布局位置
 * - ⚠️ 锁定元素（locked === true）：可选中、可 hover；不可变换、不可删除等（见各 canXxx 方法）
 * - ⚠️ 缺少 document.write：可选中、可 hover；不能变换、不能删除等（见各 canXxx）
 * - ✅ 无 document.write 时允许使用选择工具和平移工具
 */
export class PermissionManager {
	private canvas: Canvas
	private readonly accessPolicy: CanvasAccessPolicy

	constructor(options: {
		canvas: Canvas
		accessMode?: CanvasAccessMode
		capabilities?: Partial<Record<CanvasCapability, boolean>>
	}) {
		const { canvas } = options
		this.canvas = canvas
		this.accessPolicy = new CanvasAccessPolicy({
			mode: options.accessMode,
			capabilities: options.capabilities,
		})
	}

	/** Canvas-wide capability decisions are exposed through the permission facade. */
	public can(capability: CanvasCapability): boolean {
		return this.accessPolicy.getContext().can(capability)
	}

	public getContext(): CanvasAccessContext {
		return this.accessPolicy.getContext()
	}

	public setAccessContext(update: CanvasAccessUpdate): boolean {
		return this.accessPolicy.setAccess(update)
	}

	public authorize(capability?: CanvasCapability): CanvasAuthorizationResult {
		return this.accessPolicy.authorize(capability)
	}

	public authorizeTool(definition: CanvasToolAuthorizationDefinition): CanvasAuthorizationResult {
		return this.accessPolicy.authorizeTool(definition)
	}

	/**
	 * 判断当前 Canvas 是否允许把媒体文件交给宿主下载。
	 * sideEffect.download 是访问能力；allowFileDownload 是宿主业务策略，
	 * 两者都满足时动作才可执行。
	 */
	public canDownloadFiles(): boolean {
		return (
			this.can("sideEffect.download") &&
			this.canvas.magicConfigManager.config?.permissions?.allowFileDownload !== false
		)
	}

	/** 判断当前 Canvas 是否允许把选中媒体添加到宿主对话。 */
	public canAddSelectedMediaToConversation(): boolean {
		return (
			this.can("sideEffect.copy") &&
			this.canvas.magicConfigManager.config?.permissions?.elementMenuConversationActions !==
				false
		)
	}

	/**
	 * 判断元素是否可见
	 *
	 * @param element - 元素数据
	 * @returns 元素是否可见（visible !== false）
	 *
	 * 当元素的 visible 属性设置为 false 时，元素的交互行为：
	 * - ❌ 不显示在画布上
	 * - ❌ 不能 hover
	 * - ❌ 不能通过画布点击选中
	 * - ❌ 不能通过框选选中
	 * - ❌ 不显示高亮边框
	 * - ✅ 仍参与对齐/分布/排列的几何范围计算
	 * - ❌ 不参与吸附引导线计算
	 * - ✅ 可以通过图层面板选中（用于编辑属性）
	 * - ✅ 可以通过图层面板选中后进行变换、删除等操作
	 */
	public isVisible(element: LayerElement | undefined): boolean {
		if (!element) return false
		return element.visible !== false
	}

	/**
	 * 判断元素是否被锁定
	 *
	 * @param element - 元素数据
	 * @returns 元素是否被锁定（locked === true）
	 *
	 * 当元素的 locked 属性设置为 true 时，元素的交互行为：
	 * - ✅ 可以 hover、可以通过画布点击或框选选中
	 * - ❌ 不显示 Transformer 控制框
	 * - ❌ 不能拖拽移动
	 * - ❌ 不能缩放
	 * - ❌ 不能旋转
	 * - ❌ 不能通过键盘快捷键删除
	 * - ⚠️ 不移动，但参与容器边界计算；不会进入自动排列布局图
	 * - ❌ 不能被添加到画框
	 * - ❌ 锁定的画框不能被解除
	 * - ❌ 不参与吸附引导线计算
	 * - ✅ 可以通过图层面板选中（用于解锁、修改样式等）
	 */
	public isLocked(element: LayerElement | undefined): boolean {
		if (!element) return false
		return element.locked === true
	}

	/**
	 * 判断元素是否可以被 hover
	 *
	 * 不可 hover 的情况：
	 * 1. 元素不存在
	 * 2. 元素不可见（visible === false）
	 *
	 * 注意：无 document.write 时允许 hover（用于查看元素信息）；锁定元素也可 hover
	 */
	public canHover(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.isVisible(element)) return false
		if (!this.canShowTransientElementAffordance()) return false
		return true
	}

	/**
	 * 判断元素是否可以作为连接线起点/终点。
	 *
	 * Frame 可作为一组画布输入的连接起点/终点；Group 仅用于局部编组，不暴露连接语义。
	 * 普通元素可通过 interactionConfig.connectable=false 显式关闭连接能力。
	 */
	public canConnect(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.canHover(element)) return false
		if (!this.canvas.elementManager.canParticipateInDocumentRelations(element.id)) return false
		if (NON_CONNECTABLE_ELEMENT_TYPES.has(element.type)) return false
		if (element.interactionConfig?.connectable === false) return false
		return true
	}

	/**
	 * 判断当前是否允许展示元素级临时交互反馈（hover、控件显隐、装饰器 affordance）。
	 *
	 * 图片特殊编辑模式属于排他式编辑态，应抑制其他元素的临时交互反馈。
	 */
	public canShowTransientElementAffordance(): boolean {
		return !this.canvas.imageEditingCoordinator.isActive()
	}

	/**
	 * 判断当前是否允许使用“选择工具专属”的交互 affordance。
	 *
	 * 例如 pointer 光标、视频控件按钮 hover、marker hover/click 等。
	 */
	public canUseSelectionToolAffordance(): boolean {
		if (!this.canShowTransientElementAffordance()) return false
		const currentTool = this.canvas.toolManager.getActiveTool()
		return !!currentTool && this.canvas.toolManager.getSelectionTool() === currentTool
	}

	/**
	 * 判断元素是否可以被选中（通过画布点击或框选）
	 *
	 * 不可选中的情况：
	 * 1. 元素不存在
	 * 2. 元素不可见（visible === false）
	 *
	 * 访问模式和锁定均不阻止选中；变换等能力见 canTransform。
	 */
	public canSelect(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.can("interaction.select")) return false
		if (!this.isVisible(element)) return false
		return true
	}

	/**
	 * 判断元素是否可以被变换（拖拽、缩放、旋转）
	 *
	 * 不可变换的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 画布缺少 document.write 能力
	 *
	 * 注意：不可见元素仍然可以被变换（通过图层面板选中后）
	 */
	public canTransform(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (!this.can("document.write")) return false
		return true
	}

	/**
	 * 判断元素是否可以被删除
	 *
	 * 不可删除的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 画布缺少 document.delete 能力
	 *
	 * 注意：不可见元素仍然可以被删除（通过图层面板选中后）
	 */
	public canDelete(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (!this.can("document.delete")) return false
		return true
	}

	/**
	 * 判断元素是否可以被重命名
	 *
	 * 不可重命名的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 画布缺少 document.write 能力
	 */
	public canRename(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (!this.can("document.write")) return false
		return true
	}

	/**
	 * 判断元素是否可以参与对齐/分布操作
	 *
	 * 不可参与的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 画布缺少 document.write 能力
	 *
	 * 隐藏节点仍然参与几何操作；它们可能通过图层面板被选中，并且必须
	 * 继续占据布局/容器边界，避免显示状态切换后节点发生意外跳动。
	 */
	public canAlign(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (!this.can("document.write")) return false
		return true
	}

	/**
	 * 判断元素是否可以被添加到画框
	 *
	 * 不可添加的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 元素本身是 Frame/Group（当前画布不支持嵌套容器）
	 * 4. 画布缺少 document.write 能力
	 *
	 * 注意：不可见元素仍然可以被添加到画框
	 */
	public canAddToFrame(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (element.type === ElementTypeEnum.Frame || element.type === ElementTypeEnum.Group) {
			return false
		}
		if (this.isLocked(element)) return false
		if (!this.can("document.write")) return false
		return true
	}

	/**
	 * 判断元素是否可以改变画框归属。
	 *
	 * 换父级同时修改源画框和目标画框的 children，因此源/目标画框锁定时
	 * 都必须拒绝；这与“元素仍在原画框内部移动”是两种不同的操作。
	 */
	public canReparentElement(
		element: LayerElement | undefined,
		sourceParent: LayerElement | undefined,
		targetParent: LayerElement | undefined,
	): boolean {
		if (!this.canAddToFrame(element)) return false
		if (element?.type === ElementTypeEnum.Frame || element?.type === ElementTypeEnum.Group) {
			return false
		}
		if (sourceParent) {
			if (sourceParent.type !== ElementTypeEnum.Frame) return false
			if (this.isLocked(sourceParent)) return false
		}
		if (targetParent) {
			if (targetParent.type !== ElementTypeEnum.Frame) return false
			if (this.isLocked(targetParent) || !this.isVisible(targetParent)) return false
		}
		return true
	}

	/**
	 * 判断画框是否可以被解除
	 *
	 * 不可解除的情况：
	 * 1. 元素不存在
	 * 2. 画框被锁定（locked === true）
	 * 3. 画布处于只读模式
	 */
	public canRemoveFrame(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (!this.can("document.write")) return false
		return true
	}

	/**
	 * 判断是否可以创建新标记
	 *
	 * 不可创建的情况：
	 * 1. 画布处于只读模式
	 */
	public canCreateMarker(): boolean {
		return this.can("document.write")
	}

	/**
	 * 判断是否可以添加图片标记
	 *
	 * 不可添加的情况：
	 * 1. 画布处于只读模式
	 * 2. canAddImageMarker 函数返回 false
	 */
	public canAddImageMarker(): boolean {
		if (!this.can("document.write")) return false
		return !this.canvas.magicConfigManager.config?.permissions?.disabledMarker
	}

	/**
	 * 判断是否可以删除标记
	 *
	 * 不可删除的情况：
	 * 1. 画布处于只读模式
	 */
	public canDeleteMarker(): boolean {
		return this.can("document.write")
	}

	/**
	 * 判断元素是否可以参与吸附引导线计算
	 *
	 * 不可参与的情况：
	 * 1. 元素不存在
	 * 2. 元素不可见（visible === false）
	 * 3. 元素被锁定（locked === true）
	 * 4. 画布处于只读模式
	 */
	public canSnap(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.isVisible(element)) return false
		if (this.isLocked(element)) return false
		if (!this.can("document.write")) return false
		return true
	}

	/**
	 * 当前选区是否存在任一锁定元素（图层顺序、创建画框等批量结构操作的前置判断）
	 */
	public isAnySelectedElementLocked(): boolean {
		for (const id of this.canvas.selectionManager.getSelectedIds()) {
			const el = this.canvas.elementManager.getElementData(id)
			if (this.isLocked(el)) {
				return true
			}
		}
		return false
	}

	/**
	 * 当前选区是否可以调整图层顺序（上移/下移/置顶/置底）
	 *
	 * 不可执行：只读、无选中、任一选中元素已锁定
	 */
	public canReorderLayersForSelection(): boolean {
		if (!this.can("document.write")) return false
		const ids = this.canvas.selectionManager.getSelectedIds()
		if (ids.length === 0) return false
		return !this.isAnySelectedElementLocked()
	}

	/**
	 * 当前选区是否可对齐 / 参与分布。
	 * 锁定项允许出现在选区中（操作会跳过它们），但 Frame/Group 与普通节点
	 * 不允许混选，普通节点也必须来自同一父级。
	 */
	public canAlignCurrentSelection(): boolean {
		if (!this.can("document.write")) return false
		const ids = this.canvas.selectionManager.getSelectedIds()
		if (ids.length === 0) return false
		const elements = ids
			.map((id) => this.canvas.elementManager.getElementData(id))
			.filter((element): element is LayerElement => Boolean(element))
		if (elements.length !== ids.length) return false

		if (elements.length === 1) {
			const [element] = elements
			if (element.type !== ElementTypeEnum.Frame && element.type !== ElementTypeEnum.Group) {
				return false
			}
			const children =
				"children" in element && Array.isArray(element.children) ? element.children : []
			return (
				!this.isLocked(element) &&
				children.some((child) => {
					const latestChild = this.canvas.elementManager.getElementData(child.id) ?? child
					return !this.isLocked(latestChild)
				})
			)
		}

		if (
			elements.some(
				(element) =>
					element.type === ElementTypeEnum.Frame ||
					element.type === ElementTypeEnum.Group,
			)
		) {
			return false
		}
		const findParentId = this.canvas.elementManager.findParentIdForElement
		const parentIds = elements.map((element) =>
			typeof findParentId === "function"
				? (findParentId.call(this.canvas.elementManager, element.id) ?? null)
				: null,
		)
		if (parentIds.some((parentId) => parentId !== parentIds[0])) return false
		const parentId = parentIds[0]
		if (parentId) {
			const parent = this.canvas.elementManager.getElementData(parentId)
			if (!parent) return false
			if (parent.type !== ElementTypeEnum.Frame && parent.type !== ElementTypeEnum.Group) {
				return false
			}
			if (this.isLocked(parent)) return false
		}
		return elements.some((element) => !this.isLocked(element))
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 清理资源
	}
}
