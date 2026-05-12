# 知识库API对接文档

## 目录
- [1. 项目文件类型更新接口](#1-项目文件类型更新接口)
- [2. 企业知识库类型更新接口](#2-企业知识库类型更新接口)
- [3. 重新选择绑定文件功能](#3-重新选择绑定文件功能)

---

## 1. 项目文件类型更新接口

### 1.1 接口概述
用于更新已存在的项目文件类型知识库的来源绑定配置。

### 1.2 接口地址
```
PUT /api/v1/knowledge-bases/{knowledge_base_code}
```

### 1.3 请求方法
`PUT`

### 1.4 请求头部
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| authorization | string | 是 | 用户授权凭证 |
| organization-code | string | 是 | 组织代码 |
| x-forwarded-user | string | 否 | 用户身份标识 |
| Content-Type | string | 是 | application/json |
| request-id | string | 是 | 请求唯一标识（自动生成） |

### 1.5 路径参数
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| knowledge_base_code | string | 是 | 知识库唯一标识码 |

### 1.6 请求体参数
```json
{
  "source_type": "project_file",
  "source_bindings": [
    {
      "provider": "project",
      "root_ref": "workspace_123456",
      "sub_root_ref": "project_789012",
      "select_all": false,
      "select_targets": [
        {
          "node_ref": "file_001",
          "node_type": "file",
          "relative_path": "/src/components/Button.tsx"
        },
        {
          "node_ref": "folder_002",
          "node_type": "folder",
          "relative_path": "/docs"
        }
      ]
    }
  ]
}
```

#### 参数说明

**主参数**
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| source_type | string | 是 | 来源类型，项目文件固定为 "project_file" |
| source_bindings | array | 是 | 来源绑定配置数组 |

**source_bindings[i] 对象**
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| provider | string | 是 | 提供者类型，项目文件固定为 "project" |
| root_ref | string | 是 | 工作空间节点引用ID（workspace_id） |
| sub_root_ref | string | 是 | 项目节点引用ID（project_id） |
| select_all | boolean | 否 | 是否全选整个项目，默认false |
| select_targets | array | 否 | 选中的目标节点列表（当select_all=false时必填） |

**select_targets[i] 对象**
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| node_ref | string | 是 | 节点引用ID |
| node_type | string | 是 | 节点类型：file（文件）或 folder（文件夹） |
| relative_path | string | 否 | 相对路径（用于展示） |

### 1.7 响应参数

**成功响应**
```json
{
  "code": 1000,
  "message": "更新成功",
  "data": {
    "code": "kb_202604210001",
    "name": "项目知识库",
    "source_type": "project_file",
    "sync_status": "processing",
    "expected_count": 50,
    "completed_count": 0,
    "source_bindings": [...]
  }
}
```

**失败响应**
```json
{
  "code": 4000,
  "message": "知识库不存在或无权限访问"
}
```

| 字段名 | 类型 | 说明 |
|--------|------|------|
| code | number | 业务状态码，1000表示成功 |
| message | string | 响应消息 |
| data | object | 返回数据对象 |
| data.code | string | 知识库代码 |
| data.sync_status | string | 同步状态：pending、processing、success、failed |
| data.expected_count | number | 预期处理文档数量 |
| data.completed_count | number | 已完成处理文档数量 |

### 1.8 状态码说明
| HTTP状态码 | 业务code | 说明 |
|-----------|----------|------|
| 200 | 1000 | 更新成功 |
| 400 | 4001 | 请求参数错误 |
| 403 | 4030 | 无权限操作 |
| 404 | 4040 | 知识库不存在 |
| 500 | 5000 | 服务器内部错误 |

### 1.9 调用示例

**JavaScript (Fetch API)**
```javascript
async function updateProjectFileKnowledgeBase(knowledgeBaseCode, bindings) {
  const response = await fetch(`/api/v1/knowledge-bases/${knowledgeBaseCode}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'authorization': 'Bearer YOUR_TOKEN',
      'organization-code': 'YOUR_ORG_CODE',
      'request-id': makeRequestId('update'),
    },
    body: JSON.stringify({
      source_type: 'project_file',
      source_bindings: bindings
    })
  });
  
  const result = await response.json();
  
  if (result.code === 1000) {
    console.log('更新成功:', result.data);
    return result.data;
  } else {
    throw new Error(result.message);
  }
}

// 使用示例
const bindings = [
  {
    provider: 'project',
    root_ref: 'workspace_123',
    sub_root_ref: 'project_456',
    select_all: false,
    select_targets: [
      {
        node_ref: 'file_001',
        node_type: 'file',
        relative_path: '/src/index.js'
      }
    ]
  }
];

updateProjectFileKnowledgeBase('kb_202604210001', bindings);
```

### 1.10 注意事项
1. 更新操作会触发重新处理流程，知识库状态会变为 `processing`
2. `select_all=true` 时，`select_targets` 可以为空数组
3. `select_all=false` 时，`select_targets` 必须至少包含一个目标
4. 更新后需要轮询知识库详情接口，监控处理进度
5. 处理进度通过 `expected_count` 和 `completed_count` 字段跟踪

---

## 2. 企业知识库类型更新接口

### 2.1 接口概述
用于更新已存在的企业知识库类型知识库的来源绑定配置。

### 2.2 接口地址
```
PUT /api/v1/knowledge-bases/{knowledge_base_code}
```

### 2.3 请求方法
`PUT`

### 2.4 请求头部
同项目文件类型接口（参考 1.4）

### 2.5 路径参数
同项目文件类型接口（参考 1.5）

### 2.6 请求体参数
```json
{
  "source_type": "enterprise_knowledge",
  "source_bindings": [
    {
      "provider": "teamshare",
      "root_ref": "kb_enterprise_123456",
      "select_all": false,
      "select_targets": [
        {
          "node_ref": "doc_001",
          "node_type": "file",
          "relative_path": "/技术文档/架构设计.md"
        },
        {
          "node_ref": "folder_002",
          "node_type": "folder",
          "relative_path": "/产品手册"
        }
      ]
    }
  ]
}
```

#### 参数说明

**主参数**
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| source_type | string | 是 | 来源类型，企业知识库固定为 "enterprise_knowledge" |
| source_bindings | array | 是 | 来源绑定配置数组 |

**source_bindings[i] 对象**
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| provider | string | 是 | 提供者类型，企业知识库固定为 "teamshare" |
| root_ref | string | 是 | 企业知识库节点引用ID（knowledge_base_id） |
| select_all | boolean | 否 | 是否全选整个知识库，默认false |
| select_targets | array | 否 | 选中的目标节点列表（当select_all=false时必填） |

**select_targets[i] 对象**
| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| node_ref | string | 是 | 节点引用ID |
| node_type | string | 是 | 节点类型：file（文档）或 folder（文件夹） |
| relative_path | string | 否 | 相对路径（用于展示） |

### 2.7 响应参数

**成功响应**
```json
{
  "code": 1000,
  "message": "更新成功",
  "data": {
    "code": "kb_202604210002",
    "name": "企业知识库",
    "source_type": "enterprise_knowledge",
    "sync_status": "processing",
    "expected_count": 30,
    "completed_count": 0,
    "source_bindings": [...]
  }
}
```

响应参数说明同项目文件类型接口（参考 1.7）

### 2.8 状态码说明
同项目文件类型接口（参考 1.8）

### 2.9 调用示例

**JavaScript (Fetch API)**
```javascript
async function updateEnterpriseKnowledgeBase(knowledgeBaseCode, bindings) {
  const response = await fetch(`/api/v1/knowledge-bases/${knowledgeBaseCode}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'authorization': 'Bearer YOUR_TOKEN',
      'organization-code': 'YOUR_ORG_CODE',
      'request-id': makeRequestId('update'),
    },
    body: JSON.stringify({
      source_type: 'enterprise_knowledge',
      source_bindings: bindings
    })
  });
  
  const result = await response.json();
  
  if (result.code === 1000) {
    console.log('更新成功:', result.data);
    return result.data;
  } else {
    throw new Error(result.message);
  }
}

// 使用示例
const bindings = [
  {
    provider: 'teamshare',
    root_ref: 'kb_enterprise_123',
    select_all: true,  // 全选整个企业知识库
    select_targets: []
  }
];

updateEnterpriseKnowledgeBase('kb_202604210002', bindings);
```

### 2.10 注意事项
1. 企业知识库不需要 `sub_root_ref` 参数（与项目文件类型的差异）
2. `provider` 必须为 `teamshare`
3. 更新操作会触发重新同步和处理流程
4. 建议使用轮询机制监控处理进度（每3秒查询一次）
5. 处理完成后 `sync_status` 会变为 `success` 或 `failed`

---

## 3. 重新选择绑定文件功能

### 3.1 功能概述
允许用户重新选择已创建知识库的来源绑定文件或文件夹，本质上是调用更新接口的前端交互流程。

### 3.2 功能流程图
```
1. 用户点击"编辑来源绑定"
   ↓
2. 加载当前知识库详情
   ↓
3. 解析现有source_bindings
   ↓
4. 展示来源树形结构（带已选中状态）
   ↓
5. 用户重新选择文件/文件夹
   ↓
6. 校验选择是否有效
   ↓
7. 调用更新接口
   ↓
8. 进入处理状态轮询
   ↓
9. 显示处理进度
   ↓
10. 完成并刷新知识库列表
```

### 3.3 前置接口调用

#### 3.3.1 获取知识库详情
**接口：** `GET /api/v1/knowledge-bases/{knowledge_base_code}`

**用途：** 获取知识库的当前配置，包括现有的source_bindings

**响应示例：**
```json
{
  "code": 1000,
  "data": {
    "code": "kb_202604210001",
    "name": "项目知识库",
    "source_type": "project_file",
    "source_bindings": [
      {
        "provider": "project",
        "root_ref": "workspace_123",
        "sub_root_ref": "project_456",
        "select_all": false,
        "select_targets": [...]
      }
    ]
  }
}
```

#### 3.3.2 获取来源节点树
**接口：** `GET /api/v1/knowledge-bases/source-bindings/nodes`

**请求参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| source_type | string | 是 | project_file 或 enterprise_knowledge_base |
| page | number | 否 | 页码，默认1 |
| page_size | number | 否 | 每页数量，默认20 |
| parent_ref | string | 否 | 父节点引用ID（加载子节点时使用） |
| parent_type | string | 否 | 父节点类型：workspace、project、folder、knowledge_base |

**用途：** 
- 加载工作空间列表（project_file类型）
- 加载项目列表（指定workspace）
- 加载文件树（指定project或folder）
- 加载企业知识库列表（enterprise_knowledge_base类型）
- 加载企业知识库文档树（指定knowledge_base）

**响应示例（工作空间列表）：**
```json
{
  "code": 1000,
  "data": {
    "list": [
      {
        "node_ref": "workspace_123",
        "node_type": "workspace",
        "name": "技术研发空间",
        "has_children": true
      }
    ],
    "total": 5,
    "page": 1,
    "page_size": 20
  }
}
```

**响应示例（文件树）：**
```json
{
  "code": 1000,
  "data": {
    "list": [
      {
        "node_ref": "folder_001",
        "node_type": "folder",
        "name": "src",
        "relative_path": "/src",
        "has_children": true
      },
      {
        "node_ref": "file_002",
        "node_type": "file",
        "name": "README.md",
        "relative_path": "/README.md",
        "has_children": false
      }
    ],
    "total": 2
  }
}
```

### 3.4 前端实现指南

#### 3.4.1 状态管理
```javascript
// 编辑器状态
const sourceBindingEditor = {
  mode: 'edit',                    // 'create' 或 'edit'
  knowledgeBaseCode: 'kb_001',     // 正在编辑的知识库代码
  knowledgeBaseName: '项目知识库',  // 知识库名称
  rawSourceType: 'project_file',   // 原始来源类型
  loading: false,                   // 加载状态
  resolutionWarning: '',           // 解析警告信息
};

// 选择流程状态
const sourceBindingFlow = {
  step: 1,  // 1=选择文件, 2=配置策略, 3=处理中
  
  // 项目文件类型状态
  project: {
    workspaces: [],              // 工作空间列表
    projects: [],                // 项目列表
    activeWorkspaceRef: '',      // 当前工作空间
    activeProjectRef: '',        // 当前项目
    wholeProjectRef: '',         // 全选的项目ID（若有）
    selectedTargets: {},         // 选中的目标 {node_ref: node}
    expandedFolders: {},         // 展开的文件夹 {node_ref: true}
    treeNodesByParent: {},       // 树节点缓存 {parentKey: nodes[]}
  },
  
  // 企业知识库类型状态
  enterprise: {
    knowledgeBases: [],              // 企业知识库列表
    activeKnowledgeBaseRef: '',      // 当前知识库
    wholeKnowledgeBaseRef: '',       // 全选的知识库ID（若有）
    selectedTargets: {},             // 选中的目标
    expandedFolders: {},             // 展开的文件夹
    treeNodesByParent: {},           // 树节点缓存
    selectedKnowledgeBase: null,     // 当前知识库节点
  },
  
  // 处理进度状态
  processing: {
    knowledgeBaseCode: '',
    knowledgeBaseName: '',
    progress: 0,                 // 进度百分比 0-100
    statusText: '等待处理',
    syncStatus: null,            // pending、processing、success、failed
    expectedCount: 0,            // 预期文档数
    completedCount: 0,           // 完成文档数
    done: false,
    error: '',
  },
};
```

#### 3.4.2 打开编辑器
```javascript
async function openSourceBindingEditor(knowledgeBase) {
  // 1. 校验知识库是否可编辑
  if (!isSourceBindingEditableKnowledgeBase(knowledgeBase)) {
    messageApi.warning('该知识库不支持编辑来源绑定');
    return;
  }
  
  // 2. 初始化编辑器状态
  setSourceBindingEditor({
    mode: 'edit',
    knowledgeBaseCode: knowledgeBase.code,
    knowledgeBaseName: knowledgeBase.name,
    rawSourceType: knowledgeBase.source_type,
    loading: true,
    resolutionWarning: '',
  });
  
  // 3. 获取知识库详情
  const detail = await fetchKnowledgeBaseByCode(knowledgeBase.code);
  if (!detail) {
    messageApi.error('加载知识库详情失败');
    return;
  }
  
  // 4. 解析source_bindings
  const bindings = detail.source_bindings || [];
  if (bindings.length === 0) {
    messageApi.warning('该知识库没有配置来源绑定');
    return;
  }
  
  const binding = bindings[0];  // 当前只支持单个绑定
  const sourceType = resolveBindingSourceType(detail, binding);
  
  // 5. 构建初始选择状态
  const flow = createEmptySourceBindingFlow();
  
  if (sourceType === 'project_file') {
    // 解析项目文件类型绑定
    flow.project = buildProjectBindingSelectionState(binding);
    
    // 加载必要的节点数据
    await loadProjectWorkspaces();
    await loadProjectProjects(binding.root_ref);
    await loadProjectTreeNodes('project', binding.sub_root_ref);
  } else if (sourceType === 'enterprise_knowledge') {
    // 解析企业知识库类型绑定
    flow.enterprise = buildEnterpriseBindingSelectionState(binding);
    
    // 加载必要的节点数据
    await loadEnterpriseKnowledgeBases();
    await loadEnterpriseTreeNodes('knowledge_base', binding.root_ref);
  }
  
  setSourceBindingFlow(flow);
  setSourceBindingEditor(prev => ({ ...prev, loading: false }));
  setCreateOpen(true);  // 打开编辑弹窗
}
```

#### 3.4.3 保存选择
```javascript
async function handleSaveSourceBindingSelection() {
  const { knowledgeBaseCode } = sourceBindingEditor;
  
  // 1. 校验选择
  if (!validateSourceBindingSelection()) {
    return;
  }
  
  // 2. 构建source_bindings
  const bindings = buildSourceBindings(
    createDraft.sourceType,
    sourceBindingFlow
  );
  
  // 3. 调用更新接口
  setSourceBindingEditor(prev => ({ ...prev, loading: true }));
  
  try {
    const result = await requestJSON(
      `/api/v1/knowledge-bases/${knowledgeBaseCode}`,
      {
        method: 'PUT',
        body: {
          source_type: createDraft.sourceType,
          source_bindings: bindings,
        },
      }
    );
    
    messageApi.success('更新成功，正在处理中...');
    
    // 4. 进入处理状态
    setSourceBindingFlow(prev => ({
      ...prev,
      step: 3,  // PROCESSING
      processing: {
        knowledgeBaseCode: result.code,
        knowledgeBaseName: result.name,
        progress: 20,
        statusText: '正在同步文件',
        syncStatus: result.sync_status,
        expectedCount: result.expected_count || 0,
        completedCount: result.completed_count || 0,
        done: false,
        error: '',
      },
    }));
    
    // 5. 启动进度轮询
    startProcessingPolling(result.code);
    
  } catch (error) {
    messageApi.error(`更新失败: ${error.message}`);
    setSourceBindingEditor(prev => ({ ...prev, loading: false }));
  }
}
```

#### 3.4.4 进度轮询
```javascript
function startProcessingPolling(knowledgeBaseCode) {
  const timer = setInterval(async () => {
    const detail = await fetchKnowledgeBaseByCode(knowledgeBaseCode);
    if (!detail) return;
    
    const expectedCount = detail.expected_count || 0;
    const completedCount = detail.completed_count || 0;
    const ratio = expectedCount > 0 
      ? Math.round((completedCount / expectedCount) * 100) 
      : 0;
    const progress = Math.max(42, Math.min(100, ratio));
    
    const doneByStatus = 
      detail.sync_status === 'success' || 
      detail.sync_status === 'failed';
    const doneByCount = 
      expectedCount > 0 && completedCount >= expectedCount;
    const done = doneByStatus || doneByCount;
    
    setSourceBindingFlow(prev => ({
      ...prev,
      processing: {
        ...prev.processing,
        syncStatus: detail.sync_status,
        expectedCount,
        completedCount,
        progress: done ? 100 : progress,
        done,
        error: detail.sync_status === 'failed' 
          ? detail.sync_status_message || '处理失败'
          : '',
        statusText: done && detail.sync_status !== 'failed'
          ? '处理完成'
          : detail.sync_status === 'failed'
          ? '处理失败'
          : expectedCount > 0
          ? `正在处理 ${completedCount}/${expectedCount}`
          : '正在处理文档',
      },
    }));
    
    if (done) {
      clearInterval(timer);
      await loadKnowledgeBases(knowledgeBaseCode);  // 刷新列表
    }
  }, 3000);  // 每3秒轮询一次
  
  return timer;
}
```

#### 3.4.5 选择校验
```javascript
function validateSourceBindingSelection() {
  if (createDraft.sourceType === 'project_file') {
    // 校验项目文件类型
    if (!sourceBindingFlow.project.activeProjectRef) {
      messageApi.warning('请选择一个项目');
      return false;
    }
    
    if (
      !sourceBindingFlow.project.wholeProjectRef &&
      Object.keys(sourceBindingFlow.project.selectedTargets).length === 0
    ) {
      messageApi.warning('请至少选择一个文件或文件夹');
      return false;
    }
  } else if (createDraft.sourceType === 'enterprise_knowledge') {
    // 校验企业知识库类型
    if (!sourceBindingFlow.enterprise.activeKnowledgeBaseRef) {
      messageApi.warning('请选择一个企业知识库');
      return false;
    }
    
    if (
      !sourceBindingFlow.enterprise.wholeKnowledgeBaseRef &&
      Object.keys(sourceBindingFlow.enterprise.selectedTargets).length === 0
    ) {
      messageApi.warning('请至少选择一个文档或文件夹');
      return false;
    }
  }
  
  return true;
}
```

#### 3.4.6 构建绑定数据
```javascript
function buildSourceBindings(sourceType, flow) {
  if (sourceType === 'project_file') {
    const { project } = flow;
    
    return [
      {
        provider: 'project',
        root_ref: project.activeWorkspaceRef,
        sub_root_ref: project.activeProjectRef,
        select_all: Boolean(project.wholeProjectRef),
        select_targets: project.wholeProjectRef
          ? []
          : Object.values(project.selectedTargets).map(node => ({
              node_ref: node.node_ref,
              node_type: node.node_type,
              relative_path: node.relative_path || '',
            })),
      },
    ];
  } else if (sourceType === 'enterprise_knowledge') {
    const { enterprise } = flow;
    
    return [
      {
        provider: 'teamshare',
        root_ref: enterprise.activeKnowledgeBaseRef,
        select_all: Boolean(enterprise.wholeKnowledgeBaseRef),
        select_targets: enterprise.wholeKnowledgeBaseRef
          ? []
          : Object.values(enterprise.selectedTargets).map(node => ({
              node_ref: node.node_ref,
              node_type: node.node_type,
              relative_path: node.relative_path || '',
            })),
      },
    ];
  }
  
  return [];
}
```

### 3.5 UI交互流程

#### 3.5.1 编辑入口
```javascript
// 在知识库菜单中添加"编辑来源绑定"选项
const knowledgeBaseMenuItems = (item) => {
  const items = [];
  
  // 仅对来源绑定类型的知识库显示
  if (isSourceBindingEditableKnowledgeBase(item)) {
    items.push({
      key: 'edit-source-binding',
      label: '编辑来源绑定',
      onClick: () => openSourceBindingEditor(item),
    });
  }
  
  return items;
};
```

#### 3.5.2 编辑弹窗结构
```jsx
<Modal
  title={
    sourceBindingEditor.mode === 'edit'
      ? `编辑知识库来源 - ${sourceBindingEditor.knowledgeBaseName}`
      : '创建知识库'
  }
  open={createOpen}
  width={800}
  footer={null}
>
  {/* 步骤1: 选择文件 */}
  {sourceBindingFlow.step === 1 && (
    <SourceBindingSelector
      sourceType={createDraft.sourceType}
      flow={sourceBindingFlow}
      onWorkspaceSelect={handleSelectProjectWorkspace}
      onProjectSelect={handleSelectProjectRoot}
      onTargetToggle={toggleProjectTarget}
      onFolderExpand={toggleProjectFolderExpanded}
      onSelectAll={toggleProjectSelectAll}
    />
  )}
  
  {/* 步骤2: 配置策略 */}
  {sourceBindingFlow.step === 2 && (
    <FragmentStrategyConfig
      draft={fragmentDraft}
      onChange={setFragmentDraft}
    />
  )}
  
  {/* 步骤3: 处理进度 */}
  {sourceBindingFlow.step === 3 && (
    <ProcessingProgress
      progress={sourceBindingFlow.processing.progress}
      statusText={sourceBindingFlow.processing.statusText}
      expectedCount={sourceBindingFlow.processing.expectedCount}
      completedCount={sourceBindingFlow.processing.completedCount}
      error={sourceBindingFlow.processing.error}
      done={sourceBindingFlow.processing.done}
    />
  )}
  
  {/* 底部按钮 */}
  <div className="modal-footer">
    {sourceBindingFlow.step === 1 && (
      <>
        <Button onClick={closeCreateKnowledgeBaseModal}>取消</Button>
        <Button 
          type="primary" 
          onClick={handleAdvanceSourceBindingStep}
        >
          下一步
        </Button>
      </>
    )}
    
    {sourceBindingFlow.step === 2 && (
      <>
        <Button onClick={handleBackSourceBindingStep}>上一步</Button>
        <Button 
          type="primary" 
          loading={sourceBindingEditor.loading}
          onClick={handleSaveSourceBindingSelection}
        >
          {sourceBindingEditor.mode === 'edit' ? '保存更新' : '创建'}
        </Button>
      </>
    )}
    
    {sourceBindingFlow.step === 3 && (
      <Button 
        type="primary"
        disabled={!sourceBindingFlow.processing.done}
        onClick={closeCreateKnowledgeBaseModal}
      >
        完成
      </Button>
    )}
  </div>
</Modal>
```

### 3.6 完整调用时序图

```
用户                前端应用              后端API              数据库
 |                    |                    |                    |
 |--点击编辑来源------>|                    |                    |
 |                    |                    |                    |
 |                    |--GET /knowledge-bases/{code}----------->|
 |                    |                    |--查询详情--------->|
 |                    |<---返回详情(含bindings)---------------|
 |                    |                    |                    |
 |                    |--GET /source-bindings/nodes---------->|
 |                    |  (加载工作空间)     |--查询节点--------->|
 |                    |<---返回节点列表-----|                    |
 |                    |                    |                    |
 |<--显示编辑弹窗------|                    |                    |
 | (已选中状态回显)    |                    |                    |
 |                    |                    |                    |
 |--用户重新选择------>|                    |                    |
 |                    |--GET /source-bindings/nodes---------->|
 |                    |  (加载子节点)      |--查询子节点-------->|
 |                    |<---返回子节点-------|                    |
 |                    |                    |                    |
 |--点击保存---------->|                    |                    |
 |                    |--PUT /knowledge-bases/{code}---------->|
 |                    |  (新bindings)      |--更新配置--------->|
 |                    |                    |--触发重新处理----->|
 |                    |<---返回处理中状态---|                    |
 |                    |                    |                    |
 |<--显示处理进度------|                    |                    |
 |                    |                    |                    |
 |                    |--[轮询3秒]-------->|                    |
 |                    |--GET /knowledge-bases/{code}---------->|
 |                    |                    |--查询进度--------->|
 |                    |<---返回进度(30/50)--|                    |
 |                    |                    |                    |
 |<--更新进度条--------|                    |                    |
 |                    |                    |                    |
 |                    |--[继续轮询]------->|                    |
 |                    |<---返回进度(50/50)--|                    |
 |                    |  (status=success)  |                    |
 |                    |                    |                    |
 |<--显示完成----------|                    |                    |
 |                    |--GET /knowledge-bases/queries--------->|
 |                    |  (刷新列表)        |--查询列表--------->|
 |                    |<---返回最新列表-----|                    |
 |                    |                    |                    |
```

### 3.7 错误处理

#### 3.7.1 常见错误场景
| 错误场景 | 错误码 | 处理方式 |
|---------|--------|---------|
| 知识库不存在 | 4040 | 提示用户并关闭编辑器 |
| 无权限操作 | 4030 | 提示用户无权限 |
| 选择为空 | 4001 | 前端校验阻止提交 |
| 节点已被删除 | 4041 | 提示节点不可用，重新选择 |
| 处理失败 | sync_status=failed | 显示错误信息，允许重试 |

#### 3.7.2 错误处理代码示例
```javascript
async function handleSaveSourceBindingSelection() {
  try {
    // ... 保存逻辑
  } catch (error) {
    // 解析错误
    const errorCode = error.code;
    const errorMessage = error.message;
    
    if (errorCode === 4040) {
      messageApi.error('知识库不存在或已被删除');
      closeCreateKnowledgeBaseModal();
    } else if (errorCode === 4030) {
      messageApi.error('您没有权限编辑此知识库');
    } else if (errorCode === 4041) {
      messageApi.warning('部分选择的文件或文件夹已被删除，请重新选择');
    } else {
      messageApi.error(`更新失败: ${errorMessage}`);
    }
    
    setSourceBindingEditor(prev => ({ ...prev, loading: false }));
  }
}
```

### 3.8 性能优化建议

1. **节点缓存**：已加载的树节点缓存在 `treeNodesByParent` 中，避免重复请求
2. **懒加载**：文件夹节点按需展开加载，不一次性加载全部
3. **分页加载**：工作空间、项目列表支持分页和"加载更多"
4. **防抖处理**：搜索、筛选操作添加防抖，减少请求频率
5. **轮询优化**：处理完成后立即停止轮询，避免不必要的请求

### 3.9 注意事项

1. **编辑限制**：仅 `source_type` 为 `project_file` 或 `enterprise_knowledge` 的知识库支持编辑
2. **单次绑定**：当前版本仅支持单个 `source_binding` 配置
3. **状态回显**：编辑时需要正确解析和回显现有选择状态
4. **处理时间**：大型项目或知识库的处理可能需要数分钟，需要提供明确的进度反馈
5. **并发控制**：同一知识库不能同时进行多个编辑操作
6. **数据同步**：处理完成后需要刷新知识库列表和文档列表

---

## 附录

### A. 辅助函数

```javascript
// 生成请求ID
function makeRequestId(prefix = 'req') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 判断知识库是否可编辑来源绑定
function isSourceBindingEditableKnowledgeBase(kb) {
  const sourceType = kb.source_type;
  return sourceType === 'project_file' || sourceType === 'enterprise_knowledge';
}

// 解析来源类型
function resolveBindingSourceType(detail, binding) {
  const provider = binding?.provider;
  if (provider === 'project') return 'project_file';
  if (provider === 'teamshare') return 'enterprise_knowledge';
  return detail?.source_type || '';
}

// 创建父节点键
function createParentKey(type, ref) {
  return `${type}::${ref}`;
}
```

### B. TypeScript 类型定义

```typescript
// 知识库类型
interface KnowledgeBase {
  code: string;
  name: string;
  source_type: 'local_file' | 'project_file' | 'enterprise_knowledge';
  sync_status: 'pending' | 'processing' | 'success' | 'failed';
  expected_count?: number;
  completed_count?: number;
  source_bindings?: SourceBinding[];
}

// 来源绑定类型
interface SourceBinding {
  provider: 'project' | 'teamshare';
  root_ref: string;
  sub_root_ref?: string;  // 仅project类型需要
  select_all: boolean;
  select_targets: SourceTarget[];
}

// 选择目标类型
interface SourceTarget {
  node_ref: string;
  node_type: 'file' | 'folder';
  relative_path?: string;
}

// 树节点类型
interface TreeNode {
  node_ref: string;
  node_type: 'workspace' | 'project' | 'folder' | 'file' | 'knowledge_base';
  name: string;
  relative_path?: string;
  has_children: boolean;
}

// 编辑器状态类型
interface SourceBindingEditor {
  mode: 'create' | 'edit';
  knowledgeBaseCode: string;
  knowledgeBaseName: string;
  rawSourceType: string | null;
  loading: boolean;
  resolutionWarning: string;
}
```

### C. 测试用例

```javascript
// 测试用例1: 项目文件类型更新（全选）
const testCase1 = {
  knowledgeBaseCode: 'kb_test_001',
  payload: {
    source_type: 'project_file',
    source_bindings: [
      {
        provider: 'project',
        root_ref: 'workspace_123',
        sub_root_ref: 'project_456',
        select_all: true,
        select_targets: [],
      },
    ],
  },
};

// 测试用例2: 项目文件类型更新（部分选择）
const testCase2 = {
  knowledgeBaseCode: 'kb_test_002',
  payload: {
    source_type: 'project_file',
    source_bindings: [
      {
        provider: 'project',
        root_ref: 'workspace_123',
        sub_root_ref: 'project_456',
        select_all: false,
        select_targets: [
          {
            node_ref: 'folder_001',
            node_type: 'folder',
            relative_path: '/src',
          },
          {
            node_ref: 'file_002',
            node_type: 'file',
            relative_path: '/README.md',
          },
        ],
      },
    ],
  },
};

// 测试用例3: 企业知识库类型更新
const testCase3 = {
  knowledgeBaseCode: 'kb_test_003',
  payload: {
    source_type: 'enterprise_knowledge',
    source_bindings: [
      {
        provider: 'teamshare',
        root_ref: 'kb_enterprise_789',
        select_all: false,
        select_targets: [
          {
            node_ref: 'doc_001',
            node_type: 'file',
            relative_path: '/文档.md',
          },
        ],
      },
    ],
  },
};
```

---

**文档版本：** v1.0.0  
**最后更新：** 2026-04-21  
**维护者：** 知识库产品团队
