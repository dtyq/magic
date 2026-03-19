# ImproveInformationModal

新用户信息完善组件，支持动态调用。**PC 端**以弹窗形式展示，**移动端**自动跳转到独立页面。

## 特性

- 🚀 **动态调用**: 无需在页面中预先挂载组件，通过函数调用触发
- 📱 **响应式适配**: PC 端弹窗 / 移动端独立页面，自动区分
- 🖱️ **拖拽上传**: 头像区域支持拖拽上传图片
- 🎯 **职业身份**: Radio 多选卡片，8 个职业身份选项
- 🔍 **获知渠道**: 分组 Select 下拉，覆盖社交媒体、视频平台、其他共 20 个选项
- 🔄 **Promise 支持**: 支持 async/await 语法，提交结果可直接 await 获取
- ♻️ **逻辑复用**: 表单逻辑和 UI 完全抽离，弹窗与移动端页面共用同一套实现

## 快速开始

```typescript
import showImproveInformationModal from "@/components/business/ImproveInformationModal"

const result = await showImproveInformationModal({
  onSubmit: async (data) => {
    await saveUserInfo(data)
  },
  onClose: () => {
    console.log("已关闭")
  },
})

if (result) {
  console.log("用户提交的信息:", result)
}
```

> **移动端行为**：调用后会通过 `history.push` 跳转到 `/improve-information` 页面，回调通过 `improveInformationPageCallbackStore` 传递给页面组件。

## API

### showImproveInformationModal(options?)

| 参数 | 类型 | 说明 |
|------|------|------|
| `options.onSubmit` | `(data: ImproveInformationData) => void \| Promise<void>` | 提交回调 |
| `options.onClose` | `() => void` | 关闭/取消回调 |

**返回值：** `Promise<ImproveInformationData | null>`

- 用户提交 → 返回 `ImproveInformationData`
- 用户关闭/取消 → 返回 `null`

### ImproveInformationData

```typescript
interface ImproveInformationData {
  userName: string              // 用户名（必填，最多 30 字符）
  avatarUrl?: string            // 头像访问 URL
  avatarKey?: string            // 头像存储 Key
  professionalIdentity?: string // 职业身份
  discoveryChannel?: string     // 获知渠道
}
```

### 工具方法

```typescript
import {
  isImproveInformationModalOpen,
  forceCloseImproveInformationModal,
} from "@/components/business/ImproveInformationModal"

isImproveInformationModalOpen()       // 是否有弹窗正在显示（仅 PC 端有效）
forceCloseImproveInformationModal()   // 强制关闭弹窗（仅 PC 端有效）
```

## 职业身份选项

| 值 | 中文 |
|----|------|
| `techDev` | 技术与开发 |
| `contentCopywriting` | 内容与文案 |
| `designCreative` | 设计与创意 |
| `adminManagement` | 行政与管理 |
| `educationResearch` | 教育与研究 |
| `student` | 学生 |
| `marketingSales` | 营销与销售 |
| `otherProfessionals` | 其他职业 |

## 获知渠道选项

| 分组 | 选项 |
|------|------|
| 社交媒体平台 | Facebook、Instagram、X、Discord、Telegram、WhatsApp、微信公众号、微博、小红书、知乎 |
| 视频平台 | TikTok、YouTube、微信视频号、抖音、哔哩哔哩 |
| 其他 | 搜索引擎、好友推荐、新闻媒体、博客文章、其他 |

## 目录结构

```
ImproveInformationModal/
├── index.ts                           # 模块入口，统一导出
├── component.tsx                      # PC 端弹窗组件（MagicModal 包裹 ImproveInformationForm）
├── types.ts                           # TypeScript 类型定义
├── constant.ts                        # 职业身份 / 获知渠道静态数据
├── utils.tsx                          # showImproveInformationModal 动态调用方法
├── hooks/
│   └── useImproveInformationForm.ts   # 表单逻辑 hook（状态、上传、拖拽、提交）
├── components/
│   └── ImproveInformationForm.tsx     # 共用表单 UI（弹窗和移动端页面共用）
└── README.md

# 移动端独立页面（复用上方 hook 和组件）
src/pages/improve-information/
├── index.tsx                          # 移动端页面组件（含 NavBar、isMobile 监听）
└── store.ts                           # 回调存储（跳转前写入，页面内读取）
```

## 架构说明

```
showImproveInformationModal()
        │
        ├─ PC 端 ──► 动态创建 React Root → ImproveInformationModal (弹窗)
        │                                          │
        └─ 移动端 ─► 写入 callbackStore             │
                  → history.push('/improve-information')   │
                       │                           │
                       ▼                           ▼
              ImproveInformationPage       ImproveInformationModal
                       │                           │
                       └──────── 共用 ─────────────┘
                          useImproveInformationForm (hook)
                          ImproveInformationForm   (UI)
```

**移动端特殊行为：**
- 跳转到 `/improve-information` 页面后，若检测到设备切换为桌面端（`isMobile` 变为 `false`），页面会自动 replace 跳转到 `Super` 路由，避免用户停留在移动端专属页面。

## 注意事项

1. 同时只允许存在一个 PC 端弹窗，新调用会自动清理上一个
2. 用户名为必填项，未填写时提交按钮禁用
3. 头像上传使用 `public` 存储类型，上传后返回可公开访问的 URL
4. 移动端页面的 `forceCloseImproveInformationModal` 无法关闭页面，需使用路由返回

## 依赖

- React 18+
- shadcn/ui（Button、Input、RadioGroup、Select）
- Tailwind CSS
- antd（MagicModal 底层）
- ahooks
- react-i18next
- antd-mobile（移动端 NavBar）
- canvas-confetti
