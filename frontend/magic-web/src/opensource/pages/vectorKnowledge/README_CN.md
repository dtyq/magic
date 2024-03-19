# 向量化知识库模块

本目录包含向量化知识库相关的组件、工具和常量定义。该模块主要用于管理和使用向量化的文档知识库。

## 目录结构

```
vectorKnowledge/
├── components/       # 组件目录
│   ├── Configuration/ # 配置相关组件
│   ├── Create/       # 创建知识库相关组件
│   ├── Details/      # 知识库详情页组件
│   ├── Embed/        # 文档向量化嵌入组件
│   ├── Setting/      # 知识库设置组件
│   ├── SubSider/     # 侧边栏导航组件
│   ├── UpdateInfoModal/ # 更新信息模态框组件
│   └── Upload/       # 文档上传组件
├── constant/         # 常量定义
│   └── index.tsx     # 包含文件类型、同步状态等常量
├── layouts/          # 布局组件
├── types/            # 类型定义
│   └── index.d.ts    # 模块类型接口
├── utils/            # 工具函数
```

## 主要功能

### 知识库管理
- 创建知识库
- 查看知识库详情
- 修改知识库设置
- 配置知识库参数

### 文档管理
- 上传文档（支持多种文件格式）
- 查看文档列表
- 删除文档（支持批量操作）
- 搜索文档
- 更新文档信息

### 文档处理
- 文档向量化处理
- 文档状态跟踪：
  - 未同步(Pending)：等待处理
  - 已同步(Success)：处理成功且可用
  - 同步失败(Failed)：处理失败
  - 同步中(Processing)：正在处理
  - 删除成功(Deleted)：成功删除
  - 删除失败(DeleteFailed)：删除失败
  - 重建中(Rebuilding)：正在重建

## 支持的文件类型
支持多种文档格式，包括：
- 文本文件（TXT）
- Markdown文件（MD）
- PDF文件（PDF）
- 表格文件（XLS、XLSX、CSV）
- 文档文件（DOCX）
- XML文件

## 技术栈
- React 
- TypeScript
- Ant Design 组件库
- Tabler Icons React 图标库
- RESTful API 交互 