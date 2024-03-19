# StylePanel 多实例隔离修复

## 问题描述

在 PPT 编辑模式下，当存在多个 `IsolatedHTMLRenderer` 实例时（例如缩略图预览和主编辑区域），StylePanel 和 iframe 没有建立一对一的关系，导致：

1. 所有 StylePanel 共享同一个全局 `stylePanelStore`
2. 在一个 iframe 中选择元素时，所有实例的 StylePanel 都会响应
3. 样式修改可能应用到错误的 iframe

## 解决方案

### 架构改进

实现了基于 React Context 的实例隔离架构：

1. **创建 Context Provider**
    - `StylePanelStoreProvider`: 为每个 `IsolatedHTMLRenderer` 创建独立的 store 实例
    - `useStylePanelStore`: Hook 用于访问实例特定的 store

2. **更新组件层次**

    ```
    IsolatedHTMLRenderer
    └── StylePanelStoreProvider (实例特定)
        ├── StylePanel → useStylePanelStore()
        ├── useHTMLEditorV2 → useStylePanelStore()
        └── SelectionOverlay
    ```

3. **重构受影响组件**
    - `useHTMLEditorV2.ts`: 使用 `useStylePanelStore()` 替代全局 store
    - `useSelectedElement.ts`: 使用 `useStylePanelStore()` 替代全局 store
    - `HistoryActions.tsx`: 使用 `useStylePanelStore()` 替代全局 store

## 修改的文件

### 新增文件

- `src/opensource/pages/superMagic/components/Detail/contents/HTML/iframe-bridge/contexts/StylePanelContext.tsx`
- `src/opensource/pages/superMagic/components/Detail/contents/HTML/iframe-bridge/contexts/index.ts`
- `src/opensource/pages/superMagic/components/Detail/contents/HTML/iframe-bridge/contexts/README.md`
- `docs/fixes/style-panel-multi-instance-fix.md`

### 修改文件

1. `IsolatedHTMLRenderer.tsx`
    - 添加 `StylePanelStoreProvider` 包裹整个组件内容
    - 导入 context

2. `hooks/useHTMLEditorV2.ts`
    - 使用 `useStylePanelStore()` hook
    - 更新依赖数组包含 `stylePanelStore`

3. `components/StylePanel/hooks/useSelectedElement.ts`
    - 使用 `useStylePanelStore()` hook
    - 更新所有依赖项

4. `components/StylePanel/controls/HistoryActions.tsx`
    - 使用 `useStylePanelStore()` hook

## 验证方法

### 场景 1: PPT 编辑模式多实例

1. 打开包含多个幻灯片的 PPT 文件
2. 进入编辑模式
3. 确认侧边栏显示多个幻灯片缩略图
4. 在主编辑区域选择一个元素
5. **验证**: StylePanel 只响应主编辑区域的选择，不影响缩略图
6. 在缩略图中点击元素
7. **验证**: 不应该影响主编辑区域的 StylePanel 状态

### 场景 2: 样式修改隔离

1. 在主编辑区域选择一个文本元素
2. 修改字体大小
3. **验证**: 只有主编辑区域的元素被修改
4. 切换到另一个幻灯片
5. **验证**: 新幻灯片的 StylePanel 状态独立，不受上一个幻灯片影响

### 场景 3: 历史记录隔离

1. 在幻灯片 A 进行样式修改
2. 记录撤销/重做按钮状态
3. 切换到幻灯片 B
4. **验证**: 幻灯片 B 的历史记录独立
5. 切回幻灯片 A
6. **验证**: 幻灯片 A 的历史记录保持不变

## 技术细节

### Store 生命周期

- 每个 `StylePanelStoreProvider` 创建一个新的 `StylePanelStore` 实例
- 当组件卸载时，store 实例会被垃圾回收
- 每个实例的 MessageBridge 只监听其对应 iframe 的事件

### 性能影响

- ✅ 无性能退化
- ✅ 每个实例只占用必要的内存
- ✅ Store 实例通过 useMemo 创建，避免不必要的重建

### 向后兼容性

- ✅ 不影响现有单实例场景
- ✅ API 保持不变
- ✅ 旧的 `StylePanelStore` 类保持不变，只是不再导出单例

## 遵循的设计原则

1. **单一职责原则**: 每个 store 只管理一个渲染实例的状态
2. **依赖注入**: 通过 Context 注入 store，便于测试
3. **组合优于继承**: 使用 Provider 组合模式
4. **最小惊讶原则**: 每个实例的行为独立且可预测

## 后续建议

1. 考虑添加集成测试验证多实例场景
2. 监控生产环境中的实例数量和内存使用
3. 如有需要，可以添加实例标识符用于调试

## 相关 Issue

- 修复了多实例情况下 StylePanel 和 iframe 的一对一关系问题
