# 分享功能完善说明

## 已完成的工作

### 1. 国际化文案
- ✅ 添加了团队可访问、文件分享相关的中英文文案
- ✅ 位置：`src/opensource/assets/locales/zh_CN/super.json` 和 `src/opensource/assets/locales/en_US/super.json`

### 2. Mock API
- ✅ 创建了文件分享的Mock API
- ✅ 位置：`src/opensource/pages/superMagic/utils/api.ts`
- ✅ 包含：`createFileShare`, `cancelFileShare`, `getFileShareInfo`

### 3. 类型定义
- ✅ 更新了`ShareExtraData`支持文件分享的更多设置
- ✅ 添加了`FileSelectorProps`和`VipFeatureConfig`
- ✅ 位置：`src/opensource/pages/superMagic/components/Share/types.ts`

### 4. ShareTypeSelector 组件
- ✅ 提取为独立可复用组件
- ✅ 支持话题和文件两种分享模式
- ✅ 集成VIP权限控制（访问密码、查看文件列表、隐藏创建者信息）
- ✅ 位置：`src/opensource/pages/superMagic/components/Share/ShareTypeSelector/`

特性：
- 三种分享类型：禁止分享、团队可访问、互联网可访问
- 互联网分享支持访问密码（VIP）
- 文件分享支持更多设置面板：
  - 允许复制项目文件（普通）
  - 可查看文件列表（VIP）
  - 隐藏"由超级麦吉创造"字样（VIP）
- 所有样式使用token变量
- 行高使用像素值

### 5. FileSelector 组件
- ✅ 文件选择器组件，支持搜索和多选
- ✅ 位置：`src/opensource/pages/superMagic/components/Share/FileSelector/`

特性：
- 搜索文件功能
- Checkbox多选支持
- 树形层级显示
- 228px固定宽度

### 6. FileShareModal 组件
- ✅ 文件分享模态框内容组件
- ✅ 位置：`src/opensource/pages/superMagic/components/Share/FileShareModal/`

特性：
- 800px宽度双栏布局
- 左侧：FileSelector（228px）
- 右侧：统计栏 + ShareTypeSelector
- 实时统计已选择的文件夹和文件数量

### 7. 更新Share组件
- ✅ 重构为使用ShareTypeSelector
- ✅ 保持向后兼容
- ✅ 支持ShareType.Organization（团队可访问）

## 使用说明

### 话题分享（已集成）

现有的话题分享已自动使用新的ShareTypeSelector组件，支持团队可访问选项：

```tsx
import ShareModal from "@/opensource/pages/superMagic/components/Share/Modal"
import { ShareType, ShareMode } from "@/opensource/pages/superMagic/components/Share/types"

<ShareModal
  open={visible}
  types={[ShareType.OnlySelf, ShareType.Organization, ShareType.Internet]}
  shareMode={ShareMode.Topic}
  shareContext={{
    resource_type: ResourceType.Topic,
    resource_id: "topic-id"
  }}
  afterSubmit={({ type, extraData }) => {
    // 处理分享设置
    handleShareFunction({ type, extraData, topicId, resourceType })
  }}
  onCancel={() => setVisible(false)}
/>
```

### 文件分享（待集成）

使用FileShareModal组件实现文件分享：

```tsx
import MagicModal from "@/opensource/components/base/MagicModal"
import FileShareModal from "@/opensource/pages/superMagic/components/Share/FileShareModal"
import { ShareType } from "@/opensource/pages/superMagic/components/Share/types"

<MagicModal
  open={visible}
  width={800}
  title="分享文件"
  onCancel={() => setVisible(false)}
  footer={null}
>
  <FileShareModal
    topicId="topic-id"
    attachments={fileList}  // 文件列表
    types={[ShareType.OnlySelf, ShareType.Organization, ShareType.Internet]}
    shareUrl={generatedShareUrl}
    onSubmit={({ type, extraData }) => {
      // 处理文件分享
      const { fileIds, selectedFiles, ...settings } = extraData
      createFileShare({
        topic_id: topicId,
        file_ids: fileIds,
        share_type: type,
        ...settings
      })
    }}
  />
</MagicModal>
```

## 待完成工作

### 1. 集成到TopicFilesCore
需要在`useFileOperations.ts`中更新`handleShareItem`：

```tsx
// 当前实现只处理单个文件
const handleShareItem = useCallback((item: AttachmentItem) => {
  if (item.is_directory) {
    console.log("分享文件夹", item)
    return
  }
  
  if (item.file_id) {
    setShareFileInfo({
      fileId: item.file_id,
      fileName: item.display_filename || item.file_name,
    })
    setShareModalVisible(true)
  }
}, [])

// TODO: 支持多文件/文件夹分享
// 1. 检测是否有多个选中项
// 2. 传递选中的文件列表到FileShareModal
// 3. 使用新的createFileShare API
```

### 2. 右键菜单更新
在`useContextMenu.tsx`中，"分享文件"和"分享文件夹"菜单项已存在，点击时会调用`handleShareItem`，只需确保传递正确的参数。

### 3. 真实API替换
将Mock API替换为真实的后端API：

```typescript
// 替换 src/opensource/pages/superMagic/utils/api.ts 中的Mock实现
export const createFileShare = async (params) => {
  return magicClient.post(`/api/v1/share/files`, params)
}

export const cancelFileShare = async (params) => {
  return magicClient.delete(`/api/v1/share/files/${params.topic_id}`)
}

export const getFileShareInfo = async (params) => {
  return magicClient.get(`/api/v1/share/files/${params.topic_id}/setting`)
}
```

## VIP权限说明

### VIP功能列表
- 访问密码
- 可查看文件列表
- 隐藏"由超级麦吉创造"字样

### 权限判断
```typescript
const isPaidUser = userStore.user.organizationSubscriptionInfo?.is_paid_plan
```

### 非付费用户点击VIP功能
自动弹出套餐购买弹窗：
```typescript
openPaidPackageModal(PaidPackageModal.Subscription)
```

## 样式规范

### 颜色
- 优先使用token变量：`token.colorText`, `token.colorBorder`等
- 特殊颜色（token中没有的）：
  - 禁止分享：`#FF4D3A`
  - 团队可访问：`#315CEC`
  - 互联网可访问：`#FFA400`
  - VIP渐变：`linear-gradient(134deg, #3F8FFF 5%, #EF2FDF 96%)`

### 行高
- 使用像素值，不使用em单位
- 例如：`line-height: 20px` 而不是 `line-height: 1.4285714285714286em`

### 组件结构
```
ComponentName/
  ├── ComponentName.tsx
  ├── style.ts
  └── index.ts
```

## 测试建议

1. **话题分享测试**
   - 测试三种分享类型切换
   - 测试团队可访问选项
   - 测试访问密码开关（VIP）
   - 测试非付费用户点击VIP功能

2. **文件分享测试**
   - 测试文件选择器的搜索功能
   - 测试多选文件和文件夹
   - 测试更多设置面板
   - 测试VIP权限拦截
   - 测试统计栏的实时更新

3. **响应式测试**
   - 测试移动端适配（如果需要）
   - 测试800px弹窗的显示效果

