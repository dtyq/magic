# MagicModal.confirm 迁移指南

## 概述

MagicModal.confirm 已升级以支持 Figma 设计规范,包括响应式设计和变体系统。

## 新增参数

### variant (可选)
- **类型**: `'default' | 'destructive'`
- **默认值**: `'default'`
- **说明**: 确认对话框的变体类型
  - `default`: 普通确认(蓝/灰色按钮)
  - `destructive`: 危险操作(红色按钮)

### showIcon (可选)
- **类型**: `boolean`
- **默认值**: `false`
- **说明**: 是否显示图标。为 true 时自动显示对应变体的默认图标

### size (可选)
- **类型**: `'sm' | 'md'`
- **默认值**: 自动检测 (移动端 'sm', PC端 'md')
- **说明**: 对话框尺寸
  - `sm`: 320px 宽,居中布局,等宽按钮
  - `md`: 384px 宽,左对齐,右对齐按钮

### autoResponsive (可选)
- **类型**: `boolean`
- **默认值**: `true`
- **说明**: 是否启用自动响应式检测

## 迁移示例

### 删除操作 (Destructive)

**之前:**
```tsx
MagicModal.confirm({
  title: t("deleteConfirm"),
  content: t("deleteContent"),
  icon: <IconAlertTriangleFilled size={20} color="#FF4D3A" />,
  okButtonProps: {
    color: "danger",
    variant: "solid",
  },
  onOk: handleDelete,
})
```

**之后:**
```tsx
MagicModal.confirm({
  title: t("deleteConfirm"),
  content: t("deleteContent"),
  variant: "destructive",
  showIcon: true,
  onOk: handleDelete,
})
```

### 编辑冲突提示 (Default)

**之前:**
```tsx
MagicModal.confirm({
  title: t("editingConflictPrompt"),
  okText: t("continue"),
  onOk: handleContinue,
})
```

**之后:**
```tsx
MagicModal.confirm({
  title: t("editingConflictPrompt"),
  variant: "default",
  showIcon: true,
  okText: t("continue"),
  onOk: handleContinue,
})
```

### 自定义图标

```tsx
MagicModal.confirm({
  title: t("warning"),
  content: t("warningContent"),
  variant: "default",
  icon: <CustomIcon />, // 覆盖默认图标
  onOk: handleOk,
})
```

## 设计规范

### PC端 (md size, >= 768px)
- 宽度: 384px
- 布局: 水平,图标左侧,内容右侧
- 按钮: 右对齐,Cancel在左,Confirm在右
- 按钮尺寸: Cancel 32px, Confirm 32px/36px(destructive)

### 移动端 (sm size, < 768px)
- 宽度: 320px
- 布局: 垂直,图标居中,内容居中
- 按钮: 等宽,水平排列
- 按钮尺寸: 两个按钮都是 32px

## 向后兼容

- 所有现有参数仍然支持
- 不传 `variant` 时默认为 `'default'`
- 可以混用新旧参数,但建议使用新参数以获得更好的体验

## 已迁移文件

- ✅ `useContextMenu.tsx` - 文件/文件夹删除
- ✅ `useBatchDownload.tsx` - 批量删除
- ✅ `MessageHeader/index.tsx` - 话题删除
- ✅ `useShareItemActions.tsx` - 取消分享
- ✅ `usePPTSidebar.tsx` - PPT幻灯片删除
- ✅ `LongTremMemory/Table/index.tsx` - 长期记忆删除
- ✅ `DraftBox/index.tsx` - 草稿删除
- ✅ `Detail/Render.tsx` - 编辑冲突提示

## 待迁移场景

其他使用 `MagicModal.confirm` 的文件可以逐步迁移,优先级:
1. 危险操作 (删除、取消分享等) → `destructive` + `showIcon`
2. 重要提示 (编辑冲突、权限确认等) → `default` + `showIcon`
3. 一般确认 (可选) → 保持现有参数或添加 `variant`

## 测试检查清单

- [ ] PC端 default 变体显示正确
- [ ] PC端 destructive 变体显示正确(红色按钮)
- [ ] 移动端自动切换为 sm 尺寸
- [ ] 移动端按钮等宽且居中
- [ ] 图标正确显示且可自定义
- [ ] 响应式切换流畅
- [ ] 向后兼容性(旧代码仍可运行)
