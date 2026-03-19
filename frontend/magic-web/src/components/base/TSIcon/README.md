# TSIcon 图标组件

`TSIcon` 是一个基于 IconPark 的图标组件，提供了丰富的预设图标，支持自定义大小、颜色等属性。

## 属性

| 属性名 | 类型   | 默认值 | 说明                                                                  |
| ------ | ------ | ------ | --------------------------------------------------------------------- |
| type   | string | -      | 图标类型，必填，以 "ts-" 开头的图标名称，如 "ts-folder", "ts-file" 等 |
| size   | string | "24"   | 图标大小                                                              |
| color  | string | -      | 图标颜色                                                              |
| stroke | string | -      | 图标线条粗细                                                          |
| fill   | string | -      | 图标填充颜色                                                          |
| spin   | string | -      | 是否旋转，设置为 "true" 时图标会旋转                                  |
| ...    | -      | -      | 支持其他 IconPark 图标属性                                            |

## 基础用法

```tsx
import TSIcon from '@/components/base/TSIcon';

// 基础用法
<TSIcon type="ts-folder" />

// 自定义大小
<TSIcon type="ts-file" size="32" />

// 自定义颜色
<TSIcon type="ts-download" color="#1677ff" />

// 旋转图标
<TSIcon type="ts-loading" spin="true" />

// 组合使用
<div style={{ display: 'flex', gap: '8px' }}>
  <TSIcon type="ts-folder" size="20" />
  <span>文件夹</span>
</div>
```

## 可用图标

TSIcon 组件支持多种图标类型，所有图标名称都以 `ts-` 开头，包括但不限于：

-   文件类：`ts-folder`, `ts-file`, `ts-pdf-file`, `ts-image-file`, `ts-word-file` 等
-   操作类：`ts-download`, `ts-upload`, `ts-search`, `ts-edit`, `ts-delete` 等
-   界面类：`ts-menu`, `ts-home`, `ts-setting`, `ts-user` 等
-   状态类：`ts-loading`, `ts-success`, `ts-error`, `ts-warning` 等

完整的图标列表可以在组件定义中查看。

## 特点

1. **丰富的图标集**：提供了大量预设图标，覆盖常见使用场景
2. **统一的样式**：所有图标遵循统一的设计语言，视觉效果一致
3. **灵活的定制**：支持自定义大小、颜色、旋转等属性
4. **易于使用**：简单的 API，只需指定图标类型即可使用

## 何时使用

-   需要在界面中使用图标时
-   需要统一应用的图标风格时
-   需要使用特定领域的图标时，如文件类型图标
-   需要图标支持自定义大小和颜色时
-   需要使用动态图标（如旋转加载图标）时

TSIcon 组件提供了丰富的图标选择和灵活的定制选项，是构建统一视觉体验的理想选择。
