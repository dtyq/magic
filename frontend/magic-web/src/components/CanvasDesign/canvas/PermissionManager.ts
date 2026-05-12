import type { Canvas } from "./Canvas"
import type { LayerElement } from "./types"

/**
 * 权限管理器 - 统一管理元素的交互权限
 *
 * 职责：
 * 1. 管理画布的只读状态（readonly）
 * 2. 统一判断元素的可见性（visible）
 * 3. 统一判断元素的锁定状态（locked）
 * 4. 提供统一的元素交互性判断方法
 *
 * 权限判断规则：
 * - readonly（画布级别）：影响所有元素的交互
 * - locked（元素级别）：影响单个元素的交互
 * - visible（元素级别）：影响单个元素的可见性和交互
 *
 * 三者关系：
 * - 只要满足任一限制条件，元素就不可交互
 * - readonly 优先级最高（画布级别）
 * - locked 和 visible 是元素级别的限制
 *
 * 限制说明：
 * - ❌ 不可见元素（visible === false）：不显示、不能 hover、不能选中、不参与对齐
 * - ⚠️ 锁定元素（locked === true）：可选中、可 hover；不可变换、不可删除等（见各 canXxx 方法）
 * - ⚠️ 只读模式（readonly === true）：可选中、可 hover；不能变换、不能删除等（见各 canXxx）
 * - ✅ 只读模式下允许使用选择工具和平移工具
 */
export class PermissionManager {
	private canvas: Canvas

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
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
	 * - ❌ 不参与对齐操作
	 * - ❌ 不参与分布操作
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
	 * - ❌ 不参与对齐操作
	 * - ❌ 不参与分布操作
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
	 * 注意：只读模式下允许 hover（用于查看元素信息）；锁定元素也可 hover
	 */
	public canHover(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.isVisible(element)) return false
		if (!this.canShowTransientElementAffordance()) return false
		return true
	}

	/**
	 * 判断当前是否允许展示元素级临时交互反馈（hover、控件显隐、装饰器 affordance）。
	 *
	 * 裁剪和橡皮模式属于排他式编辑态，应抑制其他元素的临时交互反馈。
	 */
	public canShowTransientElementAffordance(): boolean {
		if (this.canvas.cropManager.getCroppingElementId()) return false
		if (this.canvas.eraserManager.getErasingElementId()) return false
		return true
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
	 * 只读、锁定均不阻止选中；变换等能力见 canTransform。
	 */
	public canSelect(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.isVisible(element)) return false
		return true
	}

	/**
	 * 判断元素是否可以被变换（拖拽、缩放、旋转）
	 *
	 * 不可变换的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 画布处于只读模式
	 *
	 * 注意：不可见元素仍然可以被变换（通过图层面板选中后）
	 */
	public canTransform(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (this.canvas.readonly) return false
		return true
	}

	/**
	 * 判断元素是否可以被删除
	 *
	 * 不可删除的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 画布处于只读模式
	 *
	 * 注意：不可见元素仍然可以被删除（通过图层面板选中后）
	 */
	public canDelete(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (this.canvas.readonly) return false
		return true
	}

	/**
	 * 判断元素是否可以被重命名
	 *
	 * 不可重命名的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 画布处于只读模式
	 */
	public canRename(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (this.canvas.readonly) return false
		return true
	}

	/**
	 * 判断元素是否可以参与对齐/分布操作
	 *
	 * 不可参与的情况：
	 * 1. 元素不存在
	 * 2. 元素不可见（visible === false）
	 * 3. 元素被锁定（locked === true）
	 * 4. 画布处于只读模式
	 */
	public canAlign(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.isVisible(element)) return false
		if (this.isLocked(element)) return false
		if (this.canvas.readonly) return false
		return true
	}

	/**
	 * 判断元素是否可以被添加到画框
	 *
	 * 不可添加的情况：
	 * 1. 元素不存在
	 * 2. 元素被锁定（locked === true）
	 * 3. 画布处于只读模式
	 *
	 * 注意：不可见元素仍然可以被添加到画框
	 */
	public canAddToFrame(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (this.isLocked(element)) return false
		if (this.canvas.readonly) return false
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
		if (this.canvas.readonly) return false
		return true
	}

	/**
	 * 判断是否可以创建新标记
	 *
	 * 不可创建的情况：
	 * 1. 画布处于只读模式
	 */
	public canCreateMarker(): boolean {
		return !this.canvas.readonly
	}

	/**
	 * 判断是否可以添加图片标记
	 *
	 * 不可添加的情况：
	 * 1. 画布处于只读模式
	 * 2. canAddImageMarker 函数返回 false
	 */
	public canAddImageMarker(): boolean {
		if (this.canvas.readonly) return false
		return !this.canvas.magicConfigManager.config?.permissions?.disabledMarker
	}

	/**
	 * 判断是否可以删除标记
	 *
	 * 不可删除的情况：
	 * 1. 画布处于只读模式
	 */
	public canDeleteMarker(): boolean {
		return !this.canvas.readonly
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
		if (this.canvas.readonly) return false
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
		if (this.canvas.readonly) return false
		const ids = this.canvas.selectionManager.getSelectedIds()
		if (ids.length === 0) return false
		return !this.isAnySelectedElementLocked()
	}

	/**
	 * 当前选区是否可对齐 / 参与分布（所有选中项均满足 canAlign；分布快捷键与菜单与此一致）
	 */
	public canAlignCurrentSelection(): boolean {
		if (this.canvas.readonly) return false
		const ids = this.canvas.selectionManager.getSelectedIds()
		if (ids.length === 0) return false
		return ids.every((id) => this.canAlign(this.canvas.elementManager.getElementData(id)))
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		// 清理资源
	}
}
