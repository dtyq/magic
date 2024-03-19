# Mention 类型示例文档

本文档展示了各种 mention 类型的输入数据和输出格式示例。

## 1. 文件类型 (file / project_file / upload_file)

**Handler**: `FileHandler`

**支持的类型**: `file`, `project_file`, `upload_file`

### 输入示例

```json
{
  "type": "file",
  "file_path": "/src/main.py",
  "file_url": "http://example.com/main.py"
}
```

### 输出示例

```
1. [@file_path:src/main.py]
   - 访问地址: http://example.com/main.py
```

### 生成的 Tip

```
请优先查看、阅读或理解上述被引用的文件或目录中的内容
```

---

## 2. MCP 工具类型 (mcp)

**Handler**: `MCPHandler`

### 输入示例

```json
{
  "type": "mcp",
  "name": "search_tool"
}
```

### 输出示例

```
1. [@mcp:search_tool]
```

### 生成的 Tip

```
可按需求使用上述 MCP 工具
```

---

## 3. Agent 类型 (agent)

**Handler**: `AgentHandler`

### 输入示例

**方式一：使用 `name` 字段**
```json
{
  "type": "agent",
  "name": "code_reviewer"
}
```

**方式二：使用 `agent_name` 字段**
```json
{
  "type": "agent",
  "agent_name": "test_runner"
}
```

### 输出示例

```
1. [@agent:code_reviewer]
```

### 生成的 Tip

```
可按需求使用上述 Agent
```

---

## 4. 设计标记类型 (design_marker)

**Handler**: `DesignMarkerHandler`

设计标记用于在图片上标注需要修改的区域。

### 坐标系统说明

- 原点：左上角 (0, 0)
- X 轴：向右增加
- Y 轴：向下增加
- 坐标值：归一化坐标 (0-1)
- bbox 格式：`{x, y, width, height}`

### 输入示例 1：带 bbox 坐标

```json
{
  "type": "design_marker",
  "image": "/新建画布/images/logo.png",
  "label": "修改logo颜色",
  "kind": "object",
  "bbox": {
    "x": 0.64,
    "y": 0.07,
    "width": 0.13,
    "height": 0.21
  }
}
```

### 输出示例 1

```
1. [@design_marker:修改logo颜色]
   - 图片位置: 新建画布/images/logo.png
   - 标记类型: object
   - 标记区域: 图片上方右侧的小区域
   - bbox坐标: 左上角(64.0%, 7.0%), 尺寸13.0%×21.0%
```

### 输入示例 2：不带 bbox 坐标

```json
{
  "type": "design_marker",
  "image": "/canvas/background.jpg",
  "label": "整体调整",
  "kind": "area",
  "bbox": null
}
```

### 输出示例 2

```
1. [@design_marker:整体调整]
   - 图片位置: canvas/background.jpg
   - 标记类型: area
```

### 区域位置描述规则

**水平位置**：
- `center_x < 0.33`: 左侧
- `0.33 <= center_x <= 0.67`: 中间
- `center_x > 0.67`: 右侧

**垂直位置**：
- `center_y < 0.33`: 上方
- `0.33 <= center_y <= 0.67`: 中部
- `center_y > 0.67`: 下方

**区域大小**：
- `area > 0.3`: 大区域
- `0.1 < area <= 0.3`: 中等区域
- `area <= 0.1`: 小区域

### 生成的 Tip

```
用户在 Canvas 画布图片上标记了需要修改的具体区域，需要使用画布项目管理技能或工具根据设计标记进行图片处理和精确修改
```

---

## 5. 项目目录类型 (project_directory)

**Handler**: `ProjectDirectoryHandler`

项目目录类型会根据目录中是否存在 `magic.project.js` 文件及其内容来判断项目类型。

### 5.1 设计画布项目 (design)

#### 判断条件

目录下存在 `magic.project.js` 文件，且文件中 `type` 字段为 `"design"`。

**magic.project.js 示例**：
```javascript
window.magicProjectConfig = {
  "type": "design",
  "name": "我的画布项目",
  "version": "1.0.0"
}
```

#### 输入示例

```json
{
  "type": "project_directory",
  "directory_path": "/我的设计项目/"
}
```

#### 输出示例

```
1. [@design_canvas_project:我的设计项目]
   - 项目类型: 设计画布项目
   - 项目路径: 我的设计项目
```

#### 生成的 Tip

```
用户引用了 Canvas 画布项目，需要使用画布项目管理技能或工具进行 AI 图片生成、图片搜索或设计标记处理等操作
```

---

### 5.2 幻灯片项目 (slide)

#### 判断条件

目录下存在 `magic.project.js` 文件，且文件中 `type` 字段为 `"slide"`。

**magic.project.js 示例**：
```javascript
window.magicProjectConfig = {
  "type": "slide",
  "name": "产品发布会PPT",
  "version": "1.0.0"
}
```

#### 输入示例

```json
{
  "type": "project_directory",
  "directory_path": "/产品发布会/"
}
```

#### 输出示例

```
1. [@slide_project:产品发布会]
   - 项目类型: 幻灯片项目
   - 项目路径: 产品发布会
```

#### 生成的 Tip

```
用户引用了 Slide 幻灯片项目，需要使用幻灯片/PPT制作技能或工具进行演示文稿的创建、编辑或管理操作
```

---

### 5.3 其他类型项目（预留扩展）

#### 判断条件

目录下存在 `magic.project.js` 文件，但 `type` 字段为其他值（非 `design` 或 `slide`）。

**magic.project.js 示例**：
```javascript
window.magicProjectConfig = {
  "type": "video",
  "name": "视频项目",
  "version": "1.0.0"
}
```

#### 输入示例

```json
{
  "type": "project_directory",
  "directory_path": "/视频项目/"
}
```

#### 输出示例

```
1. [@project_directory:视频项目]
   - 项目类型: video
   - 项目路径: 视频项目
```

#### 生成的 Tip

```
请优先查看、阅读或理解上述被引用的文件或目录中的内容
```

---

### 5.4 普通目录

#### 判断条件

目录下不存在 `magic.project.js` 文件，或文件格式无效。

#### 输入示例

```json
{
  "type": "project_directory",
  "directory_path": "/src/components/"
}
```

#### 输出示例

```
1. [@directory:src/components]
   - 目录路径: src/components
```

#### 生成的 Tip

```
请优先查看、阅读或理解上述被引用的文件或目录中的内容
```

---

## 完整上下文输出示例

### 输入：混合类型的 mentions

```json
[
  {
    "type": "file",
    "file_path": "/src/main.py"
  },
  {
    "type": "mcp",
    "name": "search_tool"
  },
  {
    "type": "agent",
    "name": "code_reviewer"
  },
  {
    "type": "design_marker",
    "image": "/canvas/logo.png",
    "label": "调整logo",
    "kind": "object",
    "bbox": {"x": 0.5, "y": 0.2, "width": 0.1, "height": 0.1}
  },
  {
    "type": "project_directory",
    "directory_path": "/我的画布项目/"
  }
]
```

### 输出：完整的上下文信息

```
<mentions>
以下路径均相对于工作空间根目录：
1. [@file_path:src/main.py]
2. [@mcp:search_tool]
3. [@agent:code_reviewer]
4. [@design_marker:调整logo]
   - 图片位置: canvas/logo.png
   - 标记类型: object
   - 标记区域: 图片上方中间的小区域
   - bbox坐标: 左上角(50.0%, 20.0%), 尺寸10.0%×10.0%
5. [@design_canvas_project:我的画布项目]
   - 项目类型: 设计画布项目
   - 项目路径: 我的画布项目

</mentions>

在执行任务前，请优先查看、阅读或理解上述被引用的文件或目录中的内容，可按需求使用上述 MCP 工具，可按需求使用上述 Agent，用户在 Canvas 画布图片上标记了需要修改的具体区域，需要使用画布项目管理技能或工具根据设计标记进行图片处理和精确修改，用户引用了 Canvas 画布项目，需要使用画布项目管理技能或工具进行 AI 图片生成、图片搜索或设计标记处理等操作。
```

---

## 注意事项

1. **路径标准化**：所有文件路径和目录路径都会自动去除开头的 `/`，转换为相对路径
2. **Tip 去重**：相同的 tip 文本只会出现一次
3. **Tip 顺序**：tip 按照 mention 出现的顺序收集，去重后保留首次出现的顺序
4. **异步处理**：所有 handler 的 `handle()` 和 `get_tip()` 方法都是异步的
5. **项目检测**：`project_directory` 类型会异步读取 `magic.project.js` 文件来判断项目类型
