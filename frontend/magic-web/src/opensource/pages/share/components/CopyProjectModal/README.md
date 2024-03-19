# CopyProjectModal 复制项目组件

## 概述

CopyProjectModal 是一个用于复制项目的弹窗组件，支持选择目标工作区和自定义项目名称。

## 功能特性

- ✅ 显示原项目信息（作者和项目名称）
- ✅ 可编辑的新项目名称
- ✅ 工作区列表选择（支持搜索）
- ✅ 新建工作区功能
- ✅ 完整的表单验证
- ✅ 国际化支持
- ✅ TypeScript 类型支持

## 使用方法

### 基础用法

```tsx
import CopyProjectModal from "./components/CopyProjectModal"

function YourComponent() {
  const [isOpen, setIsOpen] = useState(false)
  
  const projectData = {
    originalAuthor: "张三",
    originalProjectName: "我的项目",
    projectId: "project-123",
    defaultNewProjectName: "我的项目（副本）",
  }

  const handleCopySuccess = (copiedProject) => {
    console.log("复制成功:", copiedProject)
    // 处理复制成功后的逻辑
  }

  return (
    <CopyProjectModal
      open={isOpen}
      onCancel={() => setIsOpen(false)}
      projectData={projectData}
      onCopySuccess={handleCopySuccess}
    />
  )
}
```

## API

### CopyProjectModalProps

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| open | boolean | ✅ | 弹窗是否显示 |
| onCancel | () => void | ✅ | 取消/关闭弹窗的回调 |
| projectData | ProjectData | ✅ | 项目数据 |
| onCopySuccess | (result: CopiedProjectResponse) => void | ❌ | 复制成功的回调 |

### ProjectData

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| originalAuthor | string | ✅ | 原项目作者 |
| originalProjectName | string | ✅ | 原项目名称 |
| projectId | string | ✅ | 项目ID |
| defaultNewProjectName | string | ✅ | 默认的新项目名称 |

### CopiedProjectResponse

| 属性 | 类型 | 说明 |
|------|------|------|
| project_id | string | 复制后的项目ID |
| project_name | string | 复制后的项目名称 |
| workspace_id | string | 目标工作区ID |
| workspace_name | string | 目标工作区名称 |

## 交互说明

1. **选择工作区**: 点击工作区列表中的项目进行选择
2. **搜索工作区**: 在搜索框中输入关键词过滤工作区
3. **新建工作区**: 点击"新建工作区"，输入名称后失焦或按回车保存
4. **编辑项目名称**: 在新项目名称输入框中修改名称
5. **提交复制**: 填写完整信息后点击确认按钮

## 依赖

- `@/opensource/pages/superMagic/utils/api` - 工作区和项目相关API
- `antd` - UI组件库
- `@tabler/icons-react` - 图标库
- `ahooks` - React hooks工具库
- `react-i18next` - 国际化

## 国际化

组件使用 `react-i18next` 进行国际化，需要在语言文件中添加以下翻译key：

```json
{
  "share": {
    "copyProject": "复制项目",
    "copyProjectDescription": "您可以自由更改复制项目中的任何内容，而不会影响原始的项目",
    "originalProject": "原项目",
    "newProjectName": "新项目名称",
    "enterNewProjectName": "请输入新项目名称",
    "selectWorkspace": "新项目所在位置",
    "searchWorkspace": "搜索工作区",
    "createNewWorkspace": "新建工作区",
    "enterWorkspaceName": "请输入工作区名称",
    "noWorkspaceFound": "未找到工作区",
    "copyProjectSuccess": "项目复制成功",
    "copyProjectFailed": "项目复制失败"
  }
}
```

## 注意事项

1. 确保项目中已安装所有必要的依赖
2. 复制项目的API接口 `/api/v1/super-agent/projects/copy` 需要后端支持
3. 组件会自动处理错误情况并显示相应的提示信息
4. 新建工作区功能依赖于 `createWorkspace` API
