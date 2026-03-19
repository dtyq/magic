# MagicEmoji 魔法表情组件

MagicEmoji 是一个简单的表情图片渲染组件，用于在界面中显示表情符号。该组件基于 HTML 的 img 标签实现，支持自定义表情代码、命名空间和后缀等属性。

## 属性

| 属性名 | 类型   | 默认值    | 描述                                 |
| ------ | ------ | --------- | ------------------------------------ |
| code   | string | -         | 表情的唯一代码，必填                 |
| ns     | string | "emojis/" | 表情的命名空间，用于构建表情图片路径 |
| suffix | string | ".png"    | 表情图片的文件后缀                   |
| size   | number | -         | 表情图片的大小                       |

此外，组件还支持除 `src` 和 `alt` 以外的所有 HTML img 标签属性。

## 基本用法

```tsx
import MagicEmoji from '@/components/base/MagicEmoji';

// 基本用法
<MagicEmoji code="smile" />

// 自定义命名空间和后缀
<MagicEmoji code="heart" ns="custom/" suffix=".svg" />

// 设置表情大小
<MagicEmoji code="thumbs_up" size={24} />

// 添加其他 img 属性
<MagicEmoji code="star" className="custom-emoji" onClick={handleClick} />
```

## 特性

-   **简单易用**：只需提供表情代码即可渲染表情图片
-   **高度可定制**：支持自定义命名空间、文件后缀和大小
-   **灵活性**：支持所有标准的 img 标签属性
-   **轻量级**：组件实现简洁，不引入额外依赖

## 使用场景

-   在聊天界面中显示表情符号
-   在富文本编辑器中插入表情
-   在用户界面中添加情感化元素
-   在评论或反馈系统中使用表情表达情感

MagicEmoji 组件设计简洁，易于集成到各种需要显示表情的场景中。通过提供统一的表情渲染接口，确保应用中表情的一致性和可维护性。
