# 知识库管理 API 对接文档

## 一、基础配置

### 1.1 请求头配置

所有API请求需携带以下请求头：

```json
{
  "authorization": "Bearer token或JWT token",
  "organization-code": "组织编码（如 DT001）",
  "request-id": "唯一请求ID（格式: {prefix}-{uuid}）",
  "x-forwarded-user": "用户标识",
  "Content-Type": "application/json"
}
```

### 1.2 API基础地址

```
http://127.0.0.1:9501
```

---

## 二、知识库管理API

### 2.1 创建知识库

**接口地址：** `POST /api/v1/knowledge-bases`

**请求参数：**

```json
{
  "name": "知识库名称",
  "description": "知识库描述",
  "icon": "图标URL（可选）",
  "enabled": true,
  "source_type": 1,  // 来源类型：1-本地文档, 2-自定义内容, 3-项目文件, 4-企业知识库
  "agent_codes": ["SMA-xxx"],  // 可选，数字员工编码数组
  "fragment_config": {  // 可选，切分配置
    "mode": 2,  // 1-自定义, 2-自动, 3-层级
    "normal": {  // mode=1时使用
      "text_preprocess_rule": [1, 2],  // 1-替换空格, 2-移除URL
      "segment_rule": {
        "separator": "\\n\\n",
        "chunk_size": 800,
        "chunk_overlap": 10
      }
    },
    "hierarchy": {  // mode=3时使用
      "max_level": 3,
      "keep_hierarchy_info": true,
      "text_preprocess_rule": []
    }
  },
  "source_bindings": [  // 可选，数据源绑定配置（项目文件或企业知识库）
    {
      "provider": "project",  // 或 "teamshare"
      "root_type": "project",  // 或 "knowledge_base"
      "root_ref": "项目或知识库引用ID",
      "sync_mode": "realtime",  // 或 "manual"
      "enabled": true,
      "sync_config": {},
      "targets": [  // 空数组表示绑定整个项目/知识库
        {
          "target_type": "file",  // 或 "folder"
          "target_ref": "文件或文件夹引用ID"
        }
      ]
    }
  ]
}
```

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "code": "KB-xxx",
    "name": "知识库名称",
    "description": "知识库描述",
    "enabled": true,
    "source_type": 1,
    "sync_status": 0,  // 0-待处理, 1-成功, 2-失败, 3-处理中, 6-重建中
    "document_count": 0,
    "expected_count": 0,
    "completed_count": 0,
    "agent_codes": ["SMA-xxx"],
    "created_at": 1734567890,
    "updated_at": 1734567890
  }
}
```

---

### 2.2 获取知识库列表

**接口地址：** `GET /api/v1/knowledge-bases`

**查询参数：**

```
?agent_code=SMA-xxx  // 可选，按数字员工编码筛选
&page=1
&page_size=20
```

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "list": [
      {
        "code": "KB-xxx",
        "name": "知识库名称",
        "description": "描述",
        "enabled": true,
        "source_type": 1,
        "sync_status": 1,
        "document_count": 5,
        "expected_count": 10,
        "completed_count": 8,
        "agent_codes": ["SMA-xxx"],
        "created_at": 1734567890,
        "updated_at": 1734567890
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

---

### 2.3 获取知识库详情

**接口地址：** `GET /api/v1/knowledge-bases/{code}`

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "code": "KB-xxx",
    "name": "知识库名称",
    "description": "描述",
    "enabled": true,
    "source_type": 1,
    "sync_status": 1,
    "document_count": 5,
    "expected_count": 10,
    "completed_count": 8,
    "fragment_config": {
      "mode": 2
    },
    "source_bindings": [],
    "agent_codes": ["SMA-xxx"],
    "created_at": 1734567890,
    "updated_at": 1734567890
  }
}
```

---

### 2.4 删除知识库

**接口地址：** `DELETE /api/v1/knowledge-bases/{code}`

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": null
}
```

---

## 三、文档管理API

### 3.1 创建文档

**接口地址：** `POST /api/v1/knowledge-bases/{knowledgeBaseCode}/documents`

**请求参数：**

```json
{
  "name": "文档名称",
  "enabled": true,
  "doc_type": 1,
  "doc_metadata": {
    "source": "knowledge-demo",  // 或 "custom_content"
    "source_type": "local_upload"  // 或 "custom"
  },
  "fragment_config": {
    "mode": 2
  },
  "document_file": {
    "name": "文件名.pdf",
    "key": "存储桶中的文件key",
    "type": 1,  // 1-普通文件
    "third_file_id": "",  // 可选
    "file_type": 0,
    "is_embed": false
  }
}
```

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "code": "DOC-xxx",
    "name": "文档名称",
    "enabled": true,
    "sync_status": 0,  // 0-待处理, 1-成功, 2-失败, 3-处理中, 6-重建中
    "word_count": 0,
    "document_file": {
      "name": "文件名.pdf",
      "key": "存储key",
      "type": 1
    },
    "fragment_config": {
      "mode": 2
    },
    "created_at": 1734567890,
    "updated_at": 1734567890
  }
}
```

---

### 3.2 获取文档列表

**接口地址：** `GET /api/v1/knowledge-bases/{knowledgeBaseCode}/documents`

**查询参数：**

```
?page=1
&page_size=20
```

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "list": [
      {
        "code": "DOC-xxx",
        "name": "文档名称",
        "enabled": true,
        "sync_status": 1,
        "word_count": 5000,
        "document_file": {
          "name": "文件名.pdf",
          "key": "存储key",
          "type": 1
        },
        "created_at": 1734567890,
        "updated_at": 1734567890
      }
    ],
    "total": 10,
    "page": 1,
    "page_size": 20
  }
}
```

---

### 3.3 获取文档详情

**接口地址：** `GET /api/v1/knowledge-bases/{knowledgeBaseCode}/documents/{documentCode}`

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "code": "DOC-xxx",
    "name": "文档名称",
    "enabled": true,
    "sync_status": 1,
    "word_count": 5000,
    "document_file": {
      "name": "文件名.pdf",
      "key": "存储key",
      "type": 1
    },
    "fragment_config": {
      "mode": 2
    },
    "created_at": 1734567890,
    "updated_at": 1734567890
  }
}
```

---

### 3.4 删除文档

**接口地址：** `DELETE /api/v1/knowledge-bases/{knowledgeBaseCode}/documents/{documentCode}`

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": null
}
```

---

### 3.5 获取文档原始文件链接

**接口地址：** `GET /api/v1/knowledge-bases/{knowledgeBaseCode}/documents/{documentCode}/original-file-link`

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "available": true,
    "url": "https://xxx.tos.cn/xxx",
    "name": "文件名.pdf",
    "key": "存储key",
    "type": "application/pdf"
  }
}
```

---

## 四、文件上传API

### 4.1 获取临时上传凭证

**接口地址：** `POST /api/v1/file/temporary-credential`

**请求参数：**

```json
{
  "storage": "private",
  "sts": true,
  "content_type": "application/pdf"
}
```

**响应示例（STS方式）：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "temporary_credential": {
      "host": "https://bucket.tos-cn-beijing.volces.com",
      "bucket": "bucket-name",
      "region": "cn-beijing",
      "dir": "tenant/123/knowledge-base",
      "credentials": {
        "AccessKeyId": "xxx",
        "SecretAccessKey": "xxx",
        "SessionToken": "xxx"
      }
    }
  }
}
```

**响应示例（Policy方式）：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "temporary_credential": {
      "host": "https://bucket.tos-cn-beijing.volces.com",
      "dir": "tenant/123/knowledge-base",
      "policy": "base64编码的policy",
      "x-tos-algorithm": "TOS4-HMAC-SHA256",
      "x-tos-credential": "xxx",
      "x-tos-date": "20241230T123456Z",
      "x-tos-signature": "xxx",
      "x-tos-server-side-encryption": "AES256"
    }
  }
}
```

---

### 4.2 直接上传文件（使用credential字段）

**接口地址：** `POST /api/v1/file/upload`

**请求格式：** `multipart/form-data`

**表单字段：**

```
file: File对象
key: 目标存储路径
credential: 从temporary-credential接口获取的credential字段
```

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "path": "tenant/123/knowledge-base/xxx.pdf",
    "key": "tenant/123/knowledge-base/xxx.pdf"
  }
}
```

---

## 五、切片预览与检索API

### 5.1 预览文档切片

**接口地址：** `POST /api/v1/knowledge-bases/fragments/preview`

**请求参数：**

```json
{
  "document_file": {
    "name": "文件名.pdf",
    "key": "存储key",
    "type": 1,
    "third_file_id": "",
    "file_type": 0,
    "is_embed": false
  },
  "fragment_config": {
    "mode": 2
  }
}
```

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "list": [
      {
        "title": "片段标题",
        "content": "片段内容",
        "metadata": {
          "section_title": "章节标题",
          "section_path": "第一章/第一节"
        }
      }
    ],
    "document_nodes": [
      {
        "id": "node-1",
        "type": "title",
        "text": "文档标题",
        "parent": -1,
        "children": ["node-2"]
      }
    ],
    "total": 10
  }
}
```

---

### 5.2 查询已导入文档的切片

**接口地址：** `POST /api/v1/knowledge-bases/{knowledgeBaseCode}/documents/{documentCode}/fragments/queries`

**请求参数：**

```json
{
  "page": 1,
  "page_size": 100
}
```

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "list": [
      {
        "title": "片段标题",
        "content": "片段内容",
        "metadata": {
          "section_title": "章节标题"
        }
      }
    ],
    "page": 1,
    "total": 10
  }
}
```

---

### 5.3 相似度检索

**接口地址：** `POST /api/v1/knowledge-bases/{knowledgeBaseCode}/fragments/similarity`

**请求参数：**

```json
{
  "query": "检索关键词或问题"
}
```

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "list": [
      {
        "title": "片段标题",
        "content": "片段内容",
        "score": 0.95,
        "metadata": {
          "section_title": "章节标题"
        }
      }
    ],
    "total": 5
  }
}
```

---

### 5.4 重向量化文档

**接口地址：** `POST /api/v1/knowledge-bases/{knowledgeBaseCode}/documents/{documentCode}/re-vectorized`

**请求参数：** 无

**响应示例：**

```json
{
  "code": 1000,
  "message": "success",
  "data": null
}
```

---

## 六、数据源绑定API

### 6.1 获取来源绑定节点

**接口地址：** `GET /api/v1/knowledge-bases/source-bindings/nodes`

**查询参数：**

```
?source_type=project  // 或 enterprise_knowledge_base
&parent_type=root  // 或 workspace, project, folder, knowledge_base
&parent_ref=父节点引用ID（parent_type为root时不需要）
&provider=teamshare  // 企业知识库时使用
&page=1
&page_size=20
```

**响应示例（项目工作区列表）：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "list": [
      {
        "node_type": "workspace",
        "node_ref": "workspace-xxx",
        "node_name": "工作区名称",
        "selectable": false
      }
    ],
    "page": 1,
    "total": 5
  }
}
```

**响应示例（项目列表）：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "list": [
      {
        "node_type": "project",
        "node_ref": "project-xxx",
        "node_name": "项目名称",
        "selectable": true
      }
    ],
    "page": 1,
    "total": 10
  }
}
```

**响应示例（文件树节点）：**

```json
{
  "code": 1000,
  "message": "success",
  "data": {
    "list": [
      {
        "node_type": "folder",
        "node_ref": "folder-xxx",
        "node_name": "文件夹名称",
        "selectable": true,
        "has_children": true
      },
      {
        "node_type": "file",
        "node_ref": "file-xxx",
        "node_name": "文件名.pdf",
        "selectable": true,
        "has_children": false
      }
    ]
  }
}
```

---

## 七、状态码说明

### 7.1 响应状态码

| code | 说明 |
|------|------|
| 1000 | 成功 |
| 其他 | 失败，具体错误信息在message字段 |

### 7.2 文档同步状态 (sync_status)

| 值 | 说明 |
|----|------|
| 0 | 待处理 (PENDING) |
| 1 | 成功 (SUCCESS) |
| 2 | 失败 (FAILED) |
| 3 | 处理中 (PROCESSING) |
| 4 | 已删除 (DELETED) |
| 5 | 删除失败 (DELETE_FAILED) |
| 6 | 重建中 (REBUILDING) |

### 7.3 来源类型 (source_type)

| 值 | 说明 |
|----|------|
| 1 / 101 / "local_file" | 本地文档 |
| 2 / 102 / "custom_content" | 自定义内容 |
| 3 / 103 / "project_file" | 项目文件 |
| 4 / 104 / "enterprise_knowledge_base" | 企业知识库 |

### 7.4 切分模式 (fragment_config.mode)

| 值 | 说明 |
|----|------|
| 1 | 自定义 (CUSTOM) |
| 2 | 自动 (AUTO) |
| 3 | 层级 (HIERARCHY) |

### 7.5 文本预处理规则 (text_preprocess_rule)

| 值 | 说明 |
|----|------|
| 1 | 替换空格 (REPLACE_SPACES) |
| 2 | 移除URL (REMOVE_URLS) |

---

## 八、完整业务流程示例

### 8.1 创建知识库并上传文档

```javascript
// 步骤1：创建知识库
const createKB = await fetch('/api/v1/knowledge-bases', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'authorization': 'Bearer xxx',
    'organization-code': 'DT001',
    'request-id': 'demo-' + Date.now(),
    'x-forwarded-user': ';'
  },
  body: JSON.stringify({
    name: '我的知识库',
    description: '用于存储技术文档',
    enabled: true,
    source_type: 1,
    agent_codes: ['SMA-xxx']
  })
});
const kbData = await createKB.json();
const knowledgeBaseCode = kbData.data.code;

// 步骤2：获取上传凭证
const credentialRes = await fetch('/api/v1/file/temporary-credential', {
  method: 'POST',
  headers: { /* 同上 */ },
  body: JSON.stringify({
    storage: 'private',
    sts: true,
    content_type: 'application/pdf'
  })
});
const credentialData = await credentialRes.json();
const credential = credentialData.data.temporary_credential;

// 步骤3：上传文件到对象存储（STS方式）
const file = document.querySelector('input[type="file"]').files[0];
const key = `${credential.dir}/${Date.now()}-${file.name}`;
await fetch(`${credential.host}/${encodeURIComponent(key)}`, {
  method: 'PUT',
  headers: {
    'Content-Type': file.type,
    'authorization': `TOS4-HMAC-SHA256 Credential=...`,
    'x-tos-date': '...',
    'x-tos-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-tos-security-token': credential.credentials.SessionToken
  },
  body: file
});

// 步骤4：创建文档记录
const createDoc = await fetch(`/api/v1/knowledge-bases/${knowledgeBaseCode}/documents`, {
  method: 'POST',
  headers: { /* 同上 */ },
  body: JSON.stringify({
    name: file.name,
    enabled: true,
    doc_type: 1,
    doc_metadata: {
      source: 'knowledge-demo',
      source_type: 'local_upload'
    },
    fragment_config: {
      mode: 2  // 自动切分
    },
    document_file: {
      name: file.name,
      key: key,
      type: 1
    }
  })
});
const docData = await createDoc.json();
console.log('文档创建成功:', docData.data.code);

// 步骤5：轮询文档同步状态
const checkStatus = setInterval(async () => {
  const statusRes = await fetch(
    `/api/v1/knowledge-bases/${knowledgeBaseCode}/documents/${docData.data.code}`,
    { headers: { /* 同上 */ } }
  );
  const statusData = await statusRes.json();
  if (statusData.data.sync_status === 1) {
    console.log('文档处理完成');
    clearInterval(checkStatus);
  } else if (statusData.data.sync_status === 2) {
    console.error('文档处理失败');
    clearInterval(checkStatus);
  }
}, 3000);
```

---

### 8.2 创建企业知识库绑定

```javascript
// 步骤1：获取企业知识库列表
const kbList = await fetch(
  '/api/v1/knowledge-bases/source-bindings/nodes?source_type=enterprise_knowledge_base&parent_type=root&provider=teamshare',
  { headers: { /* ... */ } }
);
const kbListData = await kbList.json();
const targetKB = kbListData.data.list[0];

// 步骤2：获取知识库文件树
const fileTree = await fetch(
  `/api/v1/knowledge-bases/source-bindings/nodes?source_type=enterprise_knowledge_base&parent_type=knowledge_base&parent_ref=${targetKB.node_ref}&provider=teamshare`,
  { headers: { /* ... */ } }
);
const fileTreeData = await fileTree.json();
const selectedFiles = fileTreeData.data.list.filter(item => item.selectable).slice(0, 2);

// 步骤3：创建带数据源绑定的知识库
const createBoundKB = await fetch('/api/v1/knowledge-bases', {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify({
    name: '绑定企业知识库',
    description: '自动同步企业知识库内容',
    enabled: true,
    source_type: 4,
    agent_codes: ['SMA-xxx'],
    fragment_config: {
      mode: 2
    },
    source_bindings: [
      {
        provider: 'teamshare',
        root_type: 'knowledge_base',
        root_ref: targetKB.node_ref,
        sync_mode: 'realtime',
        enabled: true,
        sync_config: {},
        targets: selectedFiles.map(file => ({
          target_type: file.node_type,
          target_ref: file.node_ref
        }))
      }
    ]
  })
});
const boundKBData = await createBoundKB.json();
console.log('绑定知识库创建成功:', boundKBData.data.code);
```

---

### 8.3 文档检索与预览

```javascript
// 步骤1：相似度检索
const searchRes = await fetch(
  `/api/v1/knowledge-bases/${knowledgeBaseCode}/fragments/similarity`,
  {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({
      query: '如何使用API上传文件？'
    })
  }
);
const searchData = await searchRes.json();
console.log('找到', searchData.data.total, '个相关片段');
searchData.data.list.forEach(item => {
  console.log(item.title, '相似度:', item.score);
});

// 步骤2：预览文档切片
const previewRes = await fetch(
  `/api/v1/knowledge-bases/${knowledgeBaseCode}/documents/${documentCode}/fragments/queries`,
  {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({
      page: 1,
      page_size: 100
    })
  }
);
const previewData = await previewRes.json();
console.log('文档共有', previewData.data.total, '个切片');
```

---

## 九、注意事项

### 9.1 超时设置

- 知识库列表接口：建议超时 8000ms
- 文档列表接口：建议超时 10000ms
- 文件上传接口：建议超时 15000ms
- 切片预览接口：建议超时 15000ms

### 9.2 文件命名规范

- 文件key建议格式：`{dir}/{timestamp}-{random}-{sanitized_filename}`
- 自定义内容文件名自动添加 `.md` 后缀
- 文件名中的特殊字符会被替换为下划线

### 9.3 文档同步轮询

- 文档创建后 `sync_status` 初始为 0（待处理）
- 建议每 3-5 秒轮询一次文档状态
- 重向量化后建议在 60 秒内持续轮询状态

### 9.4 数据源绑定限制

- 绑定了项目文件（source_type=3）或企业知识库（source_type=4）的知识库不能直接添加文档
- 需要到对应的数据源进行文档操作

### 9.5 分页建议

- 默认分页大小：20
- 切片查询建议每页 100 条
- 支持的文件格式：XLSX、CSV、XLS、PDF、TXT、MD、DOC、DOCX、JPG、JPEG、PNG

---

## 十、错误处理

### 10.1 常见错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| "请先选择知识库" | 未选择知识库 | 先调用创建或获取知识库接口 |
| "文件还没上传完成" | 文档key为空 | 等待文件上传完成后再导入 |
| "temporary credential 返回不完整" | 上传凭证缺失字段 | 检查凭证接口返回，确保包含必要字段 |
| "当前文档缺少 file_key" | 文档缺少存储key | 确保文档已正确上传到对象存储 |
| HTTP 超时 | 网络或服务响应慢 | 增加超时时间或重试 |

### 10.2 请求重试策略

建议对以下场景实施重试：
- 网络超时错误
- 502/503 服务暂时不可用
- 429 请求过于频繁（需要添加延迟）

不建议重试的场景：
- 400 参数错误
- 401/403 认证/权限错误
- 404 资源不存在

---

## 十一、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2024-12-30 | 初始版本，包含知识库和文档的完整CRUD操作 |
