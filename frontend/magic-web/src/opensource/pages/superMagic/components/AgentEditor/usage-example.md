# AgentEditor 使用示例

这个文档展示了如何使用重构后的 `AgentEditor` 组件的新功能，包括设置编辑器数据、获取数据、清空编辑器等操作。

## 基本用法

```tsx
import { useRef } from "react"
import AgentEditor from "./AgentEditor"
import { AgentEditorRef } from "./types"

function ParentComponent() {
  const editorRef = useRef<AgentEditorRef>(null)

  // 设置编辑器数据
  const handleSetData = async () => {
    if (editorRef.current) {
      const data = {
        time: Date.now(),
        blocks: [
          {
            id: "header-1",
            type: "header",
            data: {
              text: "这是一个标题",
              level: 1
            }
          },
          {
            id: "paragraph-1", 
            type: "paragraph",
            data: {
              text: "这是一个段落内容"
            }
          }
        ],
        version: "2.28.2"
      }

      try {
        await editorRef.current.setData(data)
        console.log("数据设置成功")
      } catch (error) {
        console.error("设置数据失败:", error)
      }
    }
  }

  // 获取编辑器数据
  const handleGetData = async () => {
    if (editorRef.current) {
      const data = await editorRef.current.getData()
      console.log("编辑器数据:", data)
    }
  }

  // 清空编辑器
  const handleClear = async () => {
    if (editorRef.current) {
      try {
        await editorRef.current.clear()
        console.log("编辑器已清空")
      } catch (error) {
        console.error("清空失败:", error)
      }
    }
  }

  // 聚焦编辑器
  const handleFocus = () => {
    if (editorRef.current) {
      editorRef.current.focus()
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={handleSetData}>设置数据</button>
        <button onClick={handleGetData}>获取数据</button>
        <button onClick={handleClear}>清空编辑器</button>
        <button onClick={handleFocus}>聚焦编辑器</button>
      </div>
      
      <AgentEditor
        ref={editorRef}
        agent={{ id: "test-agent", name: "测试代理" }}
        onChange={(value) => console.log("编辑器变化:", value)}
      />
    </div>
  )
}
```

## 设置 JSON 字符串数据

```tsx
const handleSetJsonData = async () => {
  if (editorRef.current) {
    const jsonData = `{
      "time": ${Date.now()},
      "blocks": [
        {
          "id": "code-1",
          "type": "code",
          "data": {
            "code": "console.log('Hello World')"
          }
        }
      ],
      "version": "2.28.2"
    }`

    try {
      await editorRef.current.setData(jsonData)
    } catch (error) {
      console.error("设置 JSON 数据失败:", error)
    }
  }
}
```

## 结合状态管理使用

```tsx
import { useState, useRef, useEffect } from "react"

function EditorWithState() {
  const [editorValue, setEditorValue] = useState("")
  const editorRef = useRef<AgentEditorRef>(null)

  // 从外部源加载数据
  const loadFromExternalSource = async (sourceData: any) => {
    if (editorRef.current) {
      try {
        await editorRef.current.setData(sourceData)
        setEditorValue(JSON.stringify(sourceData))
      } catch (error) {
        console.error("加载外部数据失败:", error)
      }
    }
  }

  // 保存当前编辑器数据
  const saveData = async () => {
    if (editorRef.current) {
      const data = await editorRef.current.getData()
      if (data) {
        // 保存到服务器或本地存储
        console.log("保存数据:", data)
      }
    }
  }

  return (
    <div>
      <AgentEditor
        ref={editorRef}
        agent={{ id: "state-agent", name: "状态管理代理" }}
        value={editorValue}
        onChange={setEditorValue}
      />
      
      <button onClick={saveData}>保存数据</button>
    </div>
  )
}
```

## API 方法说明

### setData(data: OutputData | string): Promise&lt;void&gt;

设置编辑器数据。支持两种格式：
- `OutputData` 对象：EditorJS 的标准数据格式
- JSON 字符串：会自动解析为 OutputData 对象

**参数:**
- `data`: 要设置的编辑器数据

**返回值:**
- `Promise<void>`: 操作完成的 Promise

### getData(): Promise&lt;OutputData | null&gt;

获取当前编辑器的数据。

**返回值:**
- `Promise<OutputData | null>`: 编辑器数据，如果获取失败返回 null

### clear(): Promise&lt;void&gt;

清空编辑器内容。

**返回值:**
- `Promise<void>`: 操作完成的 Promise

### focus(): void

聚焦到编辑器。

## 错误处理

所有异步方法都会抛出异常，建议使用 try-catch 进行错误处理：

```tsx
try {
  await editorRef.current.setData(data)
} catch (error) {
  console.error("操作失败:", error)
  // 处理错误，比如显示错误信息给用户
}
```

## 注意事项

1. 确保在编辑器初始化完成后再调用这些方法
2. 所有方法都会检查编辑器是否已初始化，未初始化时会输出警告
3. `setData` 方法会触发 `onChange` 回调，保持数据同步
4. `clear` 方法会将编辑器内容清空，并触发 `onChange` 回调传递空字符串
