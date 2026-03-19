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
 * - ❌ 锁定元素（locked === true）：不能 hover、不能选中、不能变换、不能删除
 * - ❌ 只读模式（readonly === true）：所有元素行为与 locked 一致，但允许 hover（用于查看元素信息）
 * - ✅ 可以通过图层面板选中（用于查看/编辑属性）
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
	 * - ❌ 不能 hover
	 * - ❌ 不能通过画布点击选中
	 * - ❌ 不能通过框选选中
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
	 * 3. 元素被锁定（locked === true）
	 *
	 * 注意：只读模式下允许 hover（用于查看元素信息）
	 */
	public canHover(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.isVisible(element)) return false
		if (this.isLocked(element)) return false
		return true
	}

	/**
	 * 判断元素是否可以被选中（通过画布点击或框选）
	 *
	 * 不可选中的情况：
	 * 1. 元素不存在
	 * 2. 元素不可见（visible === false）
	 * 3. 元素被锁定（locked === true）
	 * 4. 画布处于只读模式
	 */
	public canSelect(element: LayerElement | undefined): boolean {
		if (!element) return false
		if (!this.isVisible(element)) return false
		if (this.isLocked(element)) return false
		if (this.canvas.readonly) return false
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
	 * 销毁管理器
	 */
	public destroy(): void {
		// 清理资源
	}
}
