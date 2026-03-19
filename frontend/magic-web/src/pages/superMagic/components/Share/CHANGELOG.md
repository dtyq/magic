# 分享功能完善 - 变更日志

## 2026-01-26

### 性能优化 🚀

#### 问题描述
在文件数量较多（470+ 文件）的项目中，文件分享弹窗存在严重的性能问题：
- 首次打开弹窗耗时 9+ 秒
- 点击文件夹 checkbox 卡顿 35+ 秒
- 修改分享配置时响应缓慢（3-4 秒延迟）

#### 优化方案

**1. 修复内联函数导致的重复渲染**

**位置**: `FileShareModal.tsx`

**问题**: 内联箭头函数 `onDefaultOpenFileChange` 每次渲染都创建新的函数引用，破坏了 `FileSelector` 组件的 `memo` 优化，导致不必要的重渲染（68次 → 10次）。

**修复**:
```typescript
// 使用 useCallback 稳定函数引用
const handleDefaultOpenFileChange = useCallback((fileId: string) => {
    setDefaultOpenFileId(fileId)
}, [])

// 替换内联函数
<FileSelector
    onDefaultOpenFileChange={handleDefaultOpenFileChange}
    // ... 其他 props
/>
```

**2. 预计算 checkbox 状态（O(n²) → O(n)）**

**位置**: `FileSelector.tsx`

**问题**: `titleRender` 函数在每个树节点渲染时都调用 `getNodeCheckState`，该函数每次都遍历整棵树查找节点、检查选中状态、递归遍历子节点，导致复杂度为 O(n²)。对于 470 个文件，这意味着执行了约 220,000 次树遍历操作。

**修复**:
```typescript
// 使用 useMemo 预先计算并缓存所有节点的 checkbox 状态
const nodeCheckStates = useMemo(() => {
    const states = new Map<string, "checked" | "unchecked" | "indeterminate">()
    const selectedSet = new Set(selectedFileIds)
    
    // 1. 构建节点索引 O(n)
    const nodeMap = new Map<string, any>()
    const buildNodeMap = (nodes: any[]) => {
        for (const node of nodes) {
            const nodeId = node.file_id || node.id
            if (nodeId) nodeMap.set(nodeId, node)
            if (node.children?.length) buildNodeMap(node.children)
        }
    }
    buildNodeMap(attachments)
    
    // 2. 自底向上计算状态（后序遍历）O(n)
    const calculateStates = (nodes: any[]) => {
        for (const node of nodes) {
            if (node.children?.length) calculateStates(node.children)
            const nodeId = node.file_id || node.id
            if (nodeId) states.set(nodeId, calculateState(node))
        }
    }
    calculateStates(attachments)
    return states
}, [selectedFileIds, attachments])

// 在 titleRender 中直接使用缓存的状态
const checkState = nodeCheckStates.get(itemId) || "unchecked"
```

**3. 优化 handleFileToggle**

**位置**: `FileSelector.tsx`

**问题**: `handleFileToggle` 中调用 `getNodeCheckState` 重复遍历树。

**修复**:
```typescript
// 使用缓存的状态而非重新计算
const checkState = nodeCheckStates.get(fileId) || "unchecked"
```

**4. Memoize CustomTree 组件**

**位置**: `FileSelector.tsx`

**问题**: CustomTree 每次 props 变化都完全重新渲染所有节点（1670个节点），导致点击操作时长时间卡顿。

**修复**:
```typescript
// 使用 useCallback 稳定 handleExpand
const handleExpand = useCallback((newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys)
}, [])

// 使用 useMemo 包装 CustomTree
const customTreeMemo = useMemo(() => (
    <CustomTree
        treeData={treeData}
        onExpand={handleExpand}
        expandedKeys={expandedKeys}
        titleRender={titleRender}
        // ... 其他 props
    />
), [treeData, handleExpand, expandedKeys, titleRender, styles.treeArea])
```

#### 性能提升数据

| 操作场景 | 优化前耗时 | 优化后耗时 | 性能提升 |
|---------|-----------|-----------|---------|
| 首次打开弹窗（470个文件） | 9,180ms | ~100ms | **98.9%** ⚡ |
| 配置变更操作 | 3,000-4,000ms | <50ms | **99%+** ⚡ |
| 点击文件夹 checkbox | 35,551ms | <100ms | **99.7%** ⚡ |
| 组件重渲染次数 | 68次 | ~10次 | **85%** ↓ |

#### 技术要点

**算法优化**:
- 复杂度优化: O(n²) → O(n)
- 数据结构: 使用 Map 和 Set 进行快速查找
- 遍历策略: 后序遍历（自底向上）避免重复计算

**React 性能优化**:
- `useCallback`: 稳定函数引用，避免子组件不必要的重渲染
- `useMemo`: 缓存计算结果和组件实例
- `React.memo`: 配合稳定的 props 实现组件级别的缓存

**实现细节**:
- 预建节点索引，一次遍历完成所有节点的 O(1) 查找
- 使用 Set 存储选中的文件 ID，查找效率从 O(n) 提升到 O(1)
- 自底向上计算父节点状态，子节点状态已计算完成，避免重复遍历

#### 影响范围

**修改的文件**:
- `src/opensource/pages/superMagic/components/Share/FileShareModal/FileShareModal.tsx`
- `src/opensource/pages/superMagic/components/Share/FileSelector/FileSelector.tsx`

**向下兼容**:
- ✅ 保留所有原有功能和交互逻辑
- ✅ 不影响现有的分享流程
- ✅ 不改变任何 API 接口
- ✅ UI 和用户体验完全一致

#### 测试建议

**性能测试**:
- [ ] 测试大量文件场景（1000+ 文件）
- [ ] 测试深层嵌套文件夹（10+ 层级）
- [ ] 测试频繁切换选中状态
- [ ] 测试移动端性能表现

**功能回归测试**:
- [ ] 文件选择/取消选择
- [ ] 文件夹全选/取消全选
- [ ] 半选状态显示
- [ ] 默认打开文件设置
- [ ] 分享配置保存

---

## 2025-10-14

### 新增功能

#### 1. 团队可访问选项
- 为话题分享和文件分享添加"团队可访问"选项（`ShareType.Organization`）
- 当前团队所有成员可访问共享内容
- 中英文国际化支持

#### 2. 文件分享独立UI
- **FileSelector组件**: 228px宽度的文件选择器
  - 支持搜索文件
  - 支持多选（Checkbox）
  - 树形层级显示
  - 自定义滚动条样式

- **FileShareModal组件**: 800px宽度的文件分享弹窗
  - 左右分栏布局
  - 左侧：FileSelector（228px固定宽度）
  - 右侧：统计栏 + ShareTypeSelector
  - 实时统计已选文件数量

#### 3. ShareTypeSelector 组件重构
- 从Share组件中提取为独立可复用组件
- 支持话题和文件两种分享模式
- 三种分享类型：
  - 禁止分享
  - 团队可访问
  - 互联网可访问

#### 4. 更多设置面板（文件分享专属）
- **允许复制项目文件**（普通功能）
- **访问密码**（VIP功能）
  - 非付费用户点击自动弹出套餐购买
- **可查看文件列表**（VIP功能）
- **隐藏"由超级麦吉创造"字样**（VIP功能）

#### 5. VIP权限控制系统
- 基于`userStore.user.organizationSubscriptionInfo.is_paid_plan`判断
- VIP功能disabled状态视觉提示
- 点击VIP功能自动触发`openPaidPackageModal`
- 参考ModelSwitch的实现逻辑

### API变更

#### 新增Mock API
位置：`src/opensource/pages/superMagic/utils/api.ts`

```typescript
// 创建文件分享
createFileShare(params: {
  topic_id: string
  file_ids: string[]
  share_type: number
  pwd?: string
  allow_copy?: boolean
  show_file_list?: boolean
  hide_creator_info?: boolean
})

// 取消文件分享
cancelFileShare(params: {
  topic_id: string
  file_ids: string[]
})

// 获取文件分享信息
getFileShareInfo(params: {
  topic_id: string
  file_ids: string[]
})
```

### 类型定义更新

位置：`src/opensource/pages/superMagic/components/Share/types.ts`

```typescript
// ShareExtraData 新增字段
interface ShareExtraData {
  // ... 原有字段
  fileIds?: string[]
  selectedFiles?: any[]
  allowCopy?: boolean
  showFileList?: boolean
  hideCreatorInfo?: boolean
}

// 新增 FileSelectorProps
interface FileSelectorProps {
  attachments: any[]
  selectedFileIds: string[]
  onSelectionChange: (fileIds: string[], files: any[]) => void
  topicId?: string
  projectId?: string
}

// 新增 VipFeatureConfig
interface VipFeatureConfig {
  isVipFeature: boolean
  featureName?: string
}
```

### 国际化文案

#### 中文（zh_CN/super.json）
```json
{
  "share": {
    "teamAccessible": "团队可访问",
    "teamAccessibleDescription": "当前团队所有成员可访问结果回放",
    "teamFileAccessible": "团队可访问",
    "teamFileAccessibleDescription": "当前团队所有成员可访问文件",
    "selectedCount": "已选择 {{folders}} 个文件夹、{{files}} 个文件",
    "allowCopyFiles": "允许复制项目文件",
    "viewFileList": "可查看文件列表",
    "hideCreatorInfo": "隐藏\"由超级麦吉创造\"字样",
    "moreSettings": "更多设置",
    "showOriginalInfo": "显示原创信息",
    "disablePasswordWarning": "* 关闭密码后，分享数据可能被搜索引擎收录，请注意数据安全",
    "pleaseSelectFiles": "请选择要分享的文件"
  }
}
```

#### 英文（en_US/super.json）
```json
{
  "share": {
    "teamAccessible": "Team accessible",
    "teamFileAccessible": "Team accessible",
    "selectedCount": "{{folders}} Folders Selected, {{files}} Files Selected",
    "allowCopyFiles": "Allow copying of project files",
    "viewFileList": "View file list",
    "hideCreatorInfo": "Hide \"Created by SuperMagic\"",
    "moreSettings": "Settings",
    "showOriginalInfo": "Original information",
    "disablePasswordWarning": "* Disable password: Shared data may be indexed by search engines. Note data security.",
    "pleaseSelectFiles": "Please select files to share"
  }
}
```

### 样式规范更新

#### 颜色使用
- ✅ 优先使用token变量（`token.colorText`, `token.colorBorder`等）
- ✅ 特殊颜色使用常量：
  - 禁止分享：`#FF4D3A`
  - 团队可访问：`#315CEC`
  - 互联网可访问：`#FFA400`
  - VIP渐变：`linear-gradient(134deg, #3F8FFF 5%, #EF2FDF 96%)`

#### 行高使用
- ✅ 全部改用像素值（px）
- ❌ 不再使用em单位
- 示例：`line-height: 20px` 而不是 `line-height: 1.4285714285714286em`

#### 组件文件结构
```
ComponentName/
  ├── ComponentName.tsx   # 组件实现
  ├── style.ts           # 样式定义
  └── index.ts           # 导出
```

### 文件变更清单

#### 新增文件
```
src/opensource/pages/superMagic/components/Share/
  ├── ShareTypeSelector/
  │   ├── ShareTypeSelector.tsx     # 分享类型选择器
  │   ├── style.ts
  │   └── index.ts
  ├── FileSelector/
  │   ├── FileSelector.tsx          # 文件选择器
  │   ├── style.ts
  │   └── index.ts
  ├── FileShareModal/
  │   ├── FileShareModal.tsx        # 文件分享弹窗
  │   ├── style.ts
  │   └── index.ts
  ├── README.md                     # 使用说明文档
  ├── USAGE_EXAMPLE.tsx             # 使用示例
  └── CHANGELOG.md                  # 本文件
```

#### 修改文件
```
src/opensource/assets/locales/
  ├── zh_CN/super.json              # 添加中文文案
  └── en_US/super.json              # 添加英文文案

src/opensource/pages/superMagic/
  ├── utils/api.ts                  # 添加Mock API
  └── components/Share/
      ├── types.ts                  # 更新类型定义
      └── index.tsx                 # 重构使用ShareTypeSelector
```

### 兼容性

- ✅ 向后兼容现有的话题分享功能
- ✅ ShareMode.Topic 使用新的ShareTypeSelector
- ✅ ShareMode.File 使用新的FileShareModal
- ✅ 所有现有的分享流程保持不变

### 待完成工作

#### 高优先级
1. **集成到TopicFilesCore**
   - 更新`useFileOperations.ts`中的`handleShareItem`
   - 支持多文件/文件夹选择
   - 连接FileShareModal

2. **真实API对接**
   - 替换Mock API为真实后端接口
   - 处理错误情况
   - 添加loading状态

#### 中优先级
3. **测试验证**
   - 测试所有VIP权限场景
   - 测试文件选择器性能（大量文件）
   - 测试中英文切换
   - 测试响应式布局

4. **分享管理功能**
   - 话题分享列表管理
   - 文件分享列表管理
   - 分享记录查询

#### 低优先级
5. **优化建议**
   - 文件选择器虚拟滚动（如果文件很多）
   - 分享链接二维码生成
   - 分享统计数据

### 技术债务

1. FileShareModal的submit方法暂时通过函数属性暴露，后续可以优化为ref
2. Mock API需要在生产环境前替换
3. 部分any类型需要具体化（AttachmentItem类型）

### 测试建议

#### 单元测试
- [ ] ShareTypeSelector组件测试
- [ ] FileSelector组件测试
- [ ] VIP权限拦截测试

#### 集成测试
- [ ] 话题分享完整流程
- [ ] 文件分享完整流程
- [ ] 多文件选择流程

#### E2E测试
- [ ] 付费用户完整分享流程
- [ ] 非付费用户点击VIP功能
- [ ] 分享链接访问测试

## 参考文档

- Figma原型
  - 分享话题（中文）: Node 5802-133405
  - 分享话题（英文）: Node 5584-219781
  - 分享文件（中文）: Node 5584-211787
  - 分享文件（英文）: Node 5584-218040

- 相关组件
  - ModelSwitch: VIP权限控制参考
  - TopicFilesCore: 文件树渲染参考
  - OrganizationSubscriptionBadge: 付费状态判断参考

