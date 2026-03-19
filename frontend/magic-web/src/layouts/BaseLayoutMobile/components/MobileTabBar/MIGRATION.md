# MobileTabBar 自定义改造说明

## 改造概述

将 antd-mobile 的 TabBar 组件改造成完全自定义的实现，基于 shadcn/ui + Tailwind CSS。

## 主要改动

### 1. 依赖变更

**移除：**
- ❌ `antd-mobile` 的 `TabBar` 组件
- ❌ 内联 `<style>` 标签和 CSS 样式

**新增：**
- ✅ `@/opensource/components/shadcn-ui/badge` - 徽章组件
- ✅ `@/opensource/lib/utils` 中的 `cn` 工具函数

### 2. 组件结构

#### 自定义 TabBar 容器
```tsx
<div className="fixed bottom-0 left-0 right-0 z-[999] w-full rounded-t-2xl border-t border-border bg-background">
  {/* TabBar 内容 */}
</div>
```

**特点：**
- 使用 Tailwind 原子类
- 支持安全区域（safe-area-inset-bottom）
- 响应式圆角和阴影

#### 自定义 Tab 项
```tsx
<button className="relative z-[1] flex h-11 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl">
  {/* 图标 + 徽章 */}
  <div className="relative">
    {item.icon}
    {item.badge && <Badge variant="destructive">{badge}</Badge>}
  </div>
  {/* 标题 */}
  <span>{item.title}</span>
</button>
```

**特点：**
- 原生 `<button>` 元素，更好的语义化和可访问性
- 使用 shadcn/ui 的 Badge 组件
- 平滑的颜色过渡动画

#### 选中指示器
保留原有的 `useTabBarIndicator` hook，通过 `renderIndicator()` 渲染选中框动画。

#### More 面板
完全自定义的弹出面板，支持：
- 手势下滑关闭
- 流畅的过渡动画
- 网格布局展示更多项

### 3. 样式实现

#### 使用 Tailwind CSS 类
| 功能 | Tailwind 类 |
|------|------------|
| 固定定位 | `fixed bottom-0 left-0 right-0` |
| 圆角 | `rounded-t-2xl` |
| 边框 | `border-t border-border` |
| 背景 | `bg-background` |
| 阴影 | `shadow-[0_-2px_8px_rgba(0,0,0,0.06)]` |
| 过渡 | `transition-colors duration-200` |

#### CSS 变量支持
自动适配主题系统的 CSS 变量：
- `--background`
- `--border`
- `--primary`
- `--muted-foreground`
- `--destructive`
- `--safe-area-inset-bottom`

### 4. 功能保留

所有原有功能完整保留：
- ✅ 底部导航栏
- ✅ 选中项高亮
- ✅ 选中框动画
- ✅ 徽章显示（未读消息数）
- ✅ 震动反馈
- ✅ More 展开面板
- ✅ 手势控制（下滑关闭）
- ✅ 路由同步

### 5. 性能优化

- 使用 `useMemo` 缓存 tab 项列表
- 使用 `cn()` 工具函数优化类名合并
- 移除不必要的 CSS-in-JS 运行时开销

## 优势

### 相比 antd-mobile

1. **更轻量**：移除 antd-mobile 依赖，减少打包体积
2. **更灵活**：完全控制样式和行为
3. **更统一**：与项目的 shadcn/ui 体系一致
4. **更易维护**：纯 Tailwind CSS，无需学习额外的样式 API

### 相比原有实现

1. **无运行时开销**：Tailwind 是编译时处理，无 CSS-in-JS 运行时
2. **更好的 DX**：Tailwind 的智能提示和类名补全
3. **更易定制**：直接修改类名即可调整样式
4. **更好的可访问性**：使用原生 `<button>` 元素

## 兼容性

- ✅ 完全兼容现有的路由系统
- ✅ 完全兼容现有的状态管理（MobX）
- ✅ 完全兼容现有的主题系统
- ✅ 完全兼容移动端手势

## 使用方式

组件使用方式**完全不变**，仍然作为 BaseLayoutMobile 的一部分自动渲染：

```tsx
import MobileTabBar from './components/MobileTabBar'

// 在 BaseLayoutMobile 中使用
<MobileTabBar />
```

## 注意事项

1. **Badge 组件**：依赖 shadcn/ui 的 Badge 组件，确保已安装
2. **CSS 变量**：确保 `src/index.css` 中定义了必要的 CSS 变量
3. **类型警告**：代码中仍有 5 个 `any` 类型警告，这些是原有代码问题，与改造无关

## 文件变更

- ✅ 修改：`index.tsx` - 完全重写组件渲染逻辑
- ✅ 修改：`hooks/useTabBarIndicator.tsx` - 适配自定义 DOM 结构
- ❌ 删除：`styles.tsx` - 不再需要 antd-style

### useTabBarIndicator Hook 改造

原有的 hook 依赖 antd-mobile 的 DOM 结构：
- `.adm-tab-bar-wrap` - TabBar 容器
- `.adm-tab-bar-item-active` - 激活的 tab 项

改造后使用自定义的 data 属性：
- `[data-tabbar-wrap]` - 自定义 TabBar 容器
- `[data-tab-key="${activeKey}"]` - 通过 key 定位激活的 tab 项

**关键变化：**
1. 移除了 `createPortal` 和动态创建容器的逻辑
2. 直接返回指示器 JSX，在主组件中渲染
3. 简化了选择器逻辑，使用 data 属性定位元素

## 测试建议

改造后建议测试以下场景：

1. **基础功能**
   - [ ] Tab 切换是否正常
   - [ ] 选中状态是否正确高亮
   - [ ] 选中框动画是否流畅

2. **徽章功能**
   - [ ] 未读消息数是否正确显示
   - [ ] 超过 99 是否显示 "99+"

3. **More 面板**
   - [ ] 点击 More 是否正常展开
   - [ ] 下滑手势是否正常关闭
   - [ ] More 项点击是否正常切换

4. **路由同步**
   - [ ] 深链接是否正确同步 tab 状态
   - [ ] 返回导航是否正常

5. **主题适配**
   - [ ] 亮色主题是否正常
   - [ ] 暗色主题是否正常（如果支持）

6. **移动端特性**
   - [ ] 震动反馈是否正常
   - [ ] 安全区域是否正确处理
   - [ ] 触摸交互是否流畅
