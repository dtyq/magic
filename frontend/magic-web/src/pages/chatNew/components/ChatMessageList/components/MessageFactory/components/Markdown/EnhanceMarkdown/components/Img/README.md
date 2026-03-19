# Img 组件

自定义的 Markdown img 组件，支持处理 `magic_knowledge_base_file_` 格式的图片链接。

## 功能特性

- 支持普通图片链接的正常渲染
- 支持 `magic_knowledge_base_file_` 格式的特殊图片链接
- 自动调用 FileApi.getKnowledgeFileUrl 方法获取真实的文件下载链接
- 使用 ImageWrapper 组件提供更好的图片展示体验
- 提供加载状态和错误状态的友好提示
- 支持图片预览、长图检测等高级功能
- 使用枚举值管理图片前缀，便于维护

## 使用方式

该组件已经集成到 `useMarkdownConfig` 中，会自动处理 Markdown 中的 img 标签。

### 支持的图片格式

1. **普通图片链接**
   ```markdown
   ![普通图片](https://example.com/image.jpg)
   ```

2. **Magic 知识库文件链接**
   ```markdown
   ![知识库图片](magic_knowledge_base_file_DT001/588417216353927169/knowledge-base/KNOWLEDGE-682f12b7472b46-22129006/682f12d0abd9a.png)
   ```

## 工作原理

1. 检测图片 src 是否以 `ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE` 开头
2. 如果是，提取 file_key 部分（去掉前缀）
3. 调用 `FileApi.getKnowledgeFileUrl(file_key)` 方法获取真实的下载链接
4. 使用 ImageWrapper 组件渲染图片，享受其提供的高级功能
5. 如果是普通链接，直接通过 ImageWrapper 渲染

## 常量定义

组件使用枚举值来管理图片前缀，定义在 `constants.ts` 文件中：

```typescript
export const enum ImagePrefix {
  /** 知识库文件前缀 */
  MAGIC_KNOWLEDGE_BASE_FILE = "magic_knowledge_base_file_",
}

export const enum ImageType {
  /** 普通图片 */
  NORMAL = "normal",
  /** 知识库文件图片 */
  KNOWLEDGE_BASE_FILE = "knowledge_base_file",
}
```

## 状态展示

- **加载中**: 显示 "📷 加载图片中..." 的提示框
- **加载失败**: 显示 "❌ 图片加载失败" 的错误提示框
- **正常显示**: 通过 ImageWrapper 组件渲染图片，支持：
  - 图片预览功能
  - 长图检测和特殊处理
  - 网络错误重试
  - 骨架屏加载效果
  - SVG 图片特殊处理

## API 接口

组件使用 `FileApi.getKnowledgeFileUrl` 方法，该方法调用 `/api/v1/knowledge-bases/files/link` 接口：

- **接口 ID**: 299459325
- **方法**: GET
- **参数**: `key` (查询参数)
- **返回**: 
  ```typescript
  {
    url: string
    expires: number
    name: string
    uid: string
    key: string
  }
  ```

## 技术实现

- 使用 React Hooks (useState, useEffect) 管理状态
- 通过 FileApi 统一管理 API 调用
- 集成 ImageWrapper 组件提供丰富的图片展示功能
- 支持错误边界处理和用户友好的错误提示
- 独立渲染模式，不参与上下页切换
- 使用 TypeScript 枚举值提高代码可维护性

## ImageWrapper 组件特性

使用的 ImageWrapper 组件提供以下高级功能：

- **图片预览**: 支持点击图片进行预览
- **长图检测**: 自动检测长图并提供特殊样式
- **加载状态**: 提供骨架屏加载效果
- **错误处理**: 网络错误时提供重试功能
- **SVG 支持**: 特殊处理 SVG 格式图片
- **响应式**: 自适应容器大小

## 示例

当 Markdown 中包含以下内容时：

```markdown
![image](magic_knowledge_base_file_DT001/588417216353927169/knowledge-base/KNOWLEDGE-682f12b7472b46-22129006/682f12d0abd9a.png)
```

组件会：
1. 识别这是一个知识库文件链接（匹配 `ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE`）
2. 提取 file_key: `DT001/588417216353927169/knowledge-base/KNOWLEDGE-682f12b7472b46-22129006/682f12d0abd9a.png`
3. 调用 `FileApi.getKnowledgeFileUrl` 获取真实的下载链接
4. 通过 ImageWrapper 组件渲染图片，享受其提供的所有高级功能 