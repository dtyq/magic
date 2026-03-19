# MagicRichEditor 魔法富文本编辑器组件

`MagicRichEditor` 是一个基于 TipTap 的富文本编辑器组件，提供了文本格式化、图片插入、表情符号、提及功能等丰富的编辑功能。

## 属性

| 属性名            | 类型                             | 默认值 | 说明                         |
| ----------------- | -------------------------------- | ------ | ---------------------------- |
| showToolBar       | boolean                          | true   | 是否显示工具栏               |
| placeholder       | string                           | -      | 编辑器占位符文本             |
| content           | Content                          | -      | 编辑器初始内容               |
| editorProps       | UseEditorOptions                 | -      | TipTap 编辑器配置选项        |
| onEnter           | (editor: Editor) => void         | -      | 回车键按下时的回调函数       |
| enterBreak        | boolean                          | false  | 是否移除回车键的默认换行行为 |
| contentProps      | HTMLAttributes\<HTMLDivElement\> | -      | 编辑器内容区域的 HTML 属性   |
| ...HTMLAttributes | -                                | -      | 支持所有 HTML div 元素的属性 |

## 基础用法

```tsx
import { MagicRichEditor } from '@/components/base/MagicRichEditor';
import { useRef } from 'react';
import type { MagicRichEditorRef } from '@/components/base/MagicRichEditor';

// 基础用法
<MagicRichEditor
  placeholder="请输入内容..."
  style={{ height: '300px' }}
/>

// 带初始内容
<MagicRichEditor
  content="<p>这是初始内容</p>"
  style={{ height: '300px' }}
/>

// 不显示工具栏
<MagicRichEditor
  showToolBar={false}
  placeholder="无工具栏的编辑器"
  style={{ height: '200px' }}
/>

// 使用 ref 获取编辑器实例
const editorRef = useRef<MagicRichEditorRef>(null);

<MagicRichEditor
  ref={editorRef}
  placeholder="使用 ref 控制的编辑器"
  style={{ height: '300px' }}
/>

// 获取编辑器内容
const getContent = () => {
  const html = editorRef.current?.editor?.getHTML();
  console.log('编辑器内容:', html);
};

// 监听内容变化
<MagicRichEditor
  editorProps={{
    onUpdate: ({ editor }) => {
      console.log('内容已更新:', editor.getHTML());
    }
  }}
  style={{ height: '300px' }}
/>

// 自定义回车键行为
<MagicRichEditor
  enterBreak={true}
  onEnter={(editor) => {
    console.log('回车键被按下');
    // 执行自定义操作
  }}
  style={{ height: '200px' }}
/>
```

## 特点

1. **丰富的文本格式化**：支持粗体、斜体、标题、字体大小、文本对齐等多种格式化选项
2. **图片处理**：支持图片上传、粘贴、拖放，并提供图片预览和管理功能
3. **表情符号支持**：内置表情符号选择器，轻松插入表情
4. **提及功能**：支持 @ 提及用户或其他实体
5. **可定制工具栏**：可以显示或隐藏工具栏，满足不同场景需求
6. **占位符支持**：在编辑器为空时显示自定义占位符文本
7. **自定义回车行为**：可以自定义回车键的行为，适用于特殊交互场景

## 何时使用

-   需要在应用中提供富文本编辑功能时
-   需要用户能够格式化文本、插入图片等多媒体内容时
-   需要支持表情符号、提及等社交功能时
-   需要一个功能完善但界面简洁的编辑器时
-   需要自定义编辑器行为以适应特定交互需求时

MagicRichEditor 组件让你的应用拥有专业的富文本编辑能力，适合用于评论系统、内容创作、邮件编辑等多种场景。
