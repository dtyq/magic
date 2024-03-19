# MagicUpload 魔法上传组件

`MagicUpload` 是一个文件上传组件，提供了简单易用的文件上传功能，支持单文件和多文件上传，可以与其他组件如按钮或拖拽区域结合使用。

## 属性

| 属性名       | 类型                      | 默认值 | 说明                          |
| ------------ | ------------------------- | ------ | ----------------------------- |
| multiple     | boolean                   | false  | 是否支持多文件上传            |
| onFileChange | (files: FileList) => void | -      | 文件选择后的回调函数          |
| children     | ReactNode                 | -      | 自定义上传按钮或区域的内容    |
| accept       | string                    | -      | 接受的文件类型，如 "image/\*" |
| disabled     | boolean                   | false  | 是否禁用上传功能              |

## 基础用法

```tsx
import { MagicUpload } from '@/components/base/MagicUpload';
import MagicButton from '@/components/base/MagicButton';
import MagicIcon from '@/components/base/MagicIcon';
import { IconFileUpload } from '@tabler/icons-react';

// 基础用法
const handleFileChange = (files) => {
  console.log('选择的文件:', files);
};

<MagicUpload onFileChange={handleFileChange}>
  <MagicButton
    icon={<MagicIcon component={IconFileUpload} />}
  >
    上传文件
  </MagicButton>
</MagicUpload>

// 多文件上传
<MagicUpload
  multiple
  onFileChange={handleFileChange}
>
  <MagicButton>上传多个文件</MagicButton>
</MagicUpload>

// 限制文件类型
<MagicUpload
  accept="image/*"
  onFileChange={handleFileChange}
>
  <MagicButton>只上传图片</MagicButton>
</MagicUpload>

// 自定义上传区域
<MagicUpload onFileChange={handleFileChange}>
  <div style={{
    border: '2px dashed #ccc',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer'
  }}>
    <p>点击或拖拽文件到此区域上传</p>
  </div>
</MagicUpload>
```

## 特点

1. **简单易用**：提供简洁的 API，易于集成到各种场景
2. **灵活定制**：支持自定义上传按钮或区域的外观
3. **功能完整**：支持单文件和多文件上传，可以限制文件类型
4. **与其他组件协作**：可以与按钮、图标等组件结合使用

## 何时使用

-   需要用户上传文件时
-   需要自定义上传按钮或区域的外观时
-   需要限制上传文件类型时
-   需要处理单文件或多文件上传时
-   需要在表单中集成文件上传功能时

MagicUpload 组件提供了一个简单而灵活的文件上传解决方案，适用于各种需要文件上传功能的场景。
