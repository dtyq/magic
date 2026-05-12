# SelfMediaRootRender

`SelfMediaRootRender` 是 `DetailType = "self-media"` 的统一入口。

当某个目录的 `metadata.type === "self-media"` 时，详情页会把这个目录当成一个完整的“社媒项目”来渲染。根目录按平台分组声明 post 索引；每个 post 自己拥有独立的内容目录、独立的 `post.json` 和独立的卡片 HTML 文件。单项目可以同时声明多个平台，由根层 `PlatformSwitcher` 组件切换。

## 设计目标

这套结构解决两个核心问题：

1. 根配置不再堆积所有 post 的完整内容，避免 `magic.project.js` 失控膨胀。
2. 预览器只按需加载当前激活 post 的数据，切换 post 时再懒加载对应 `post.json`。

## 最新目录结构

```text
self-media-root/
├── magic.project.js
├── posts/
│   ├── ai-bill/
│   │   ├── post.json
│   │   ├── cards/
│   │   │   ├── 01.html
│   │   │   └── 02.html
│   │   └── assets/
│   ├── cost-breakdown/
│   │   ├── post.json
│   │   ├── cards/
│   │   └── assets/
│   └── ...
└── shared/
```

约束如下：

1. `magic.project.js` 只保存平台信息和 post 入口索引。
2. 每个 post 必须是一个独立目录。
3. 每个 post 目录下必须有一个 `post.json`。
4. `post.json` 内部的 `cards` 路径，相对当前 post 目录解析，而不是相对根目录解析。
5. post 自己的素材建议放在本目录 `assets/` 下；多个 post 共用的资源可以放在根目录 `shared/` 下。

## 数据组织方式

### 1. 根索引 `magic.project.js`

根文件只负责告诉系统：

1. 当前项目声明了哪些平台。
2. 每个平台下有哪些 post。
3. 每个 post 的展示名是什么。
4. 每个 post 的入口文件在哪里。

示例：

```js
window.magicProjectConfig = {
	type: "self-media",
	"self-media": {
		rednote: {
			posts: [
				{
					id: "ai-bill",
					name: "AI 账单拆解",
					entry: "posts/ai-bill/post.json",
				},
				{
					id: "cost-breakdown",
					name: "成本分析",
					entry: "posts/cost-breakdown/post.json",
				},
			],
		},
		instagram: {
			posts: [
				{
					id: "ai-bill-ig",
					name: "AI Bill Reel",
					entry: "posts/ai-bill-ig/post.json",
				},
			],
		},
		"wechat-official-accounts": {
			posts: [
				{
					id: "ppt-editable-launch",
					name: "超级麦吉 PPT 导出上线",
					entry: "posts/ppt-editable-launch/post.json",
				},
			],
		},
	},
}

window.magicProjectConfigure(window.magicProjectConfig)
```

只声明一个平台时，`PlatformSwitcher` 会自动隐藏；声明多个平台时，顶部会出现平台切换器，切换时 post 列表与缓存独立维护。

字段职责：

1. `id`: post 的稳定标识，用于缓存、切换和导出。
2. `name`: 预览器顶部切换器直接使用的展示名。
3. `entry`: post 清单文件位置，当前规范固定指向 `post.json`。

### 2. 单个 post 的 `post.json`

`post.json` 才是 post 的真正内容来源。它负责描述：

1. post 自己的 meta。
2. post 包含哪些 cards。
3. cards 在当前 post 目录下的相对路径。

示例：

```json
{
	"id": "ai-bill",
	"meta": {
		"id": "ai-bill",
		"title": "AI 账单拆解",
		"subtitle": "成本、结构与优化建议",
		"tags": "#AI #Billing",
		"author": "@magic",
		"feedTitle": "AI 账单拆解，一次讲清楚",
		"feedLikes": "1.8w",
		"commentCount": "128",
		"comments": [
			{
				"name": "Alice",
				"text": "这个结构很清晰"
			}
		]
	},
	"cards": ["cards/01.html", "cards/02.html"]
}
```

字段职责：

1. `meta`: feed/detail/scroll 视图要消费的业务信息。
2. `cards`: 当前 post 的卡片列表，顺序即展示顺序。

### 2.1 微信公众号的 post.json

微信公众号 (`wechat-official-accounts`) 的内容模型和小红书/Instagram 不同——它只有一篇 HTML 正文，外加两张封面图（大图 + 方图）。因此它不使用 `cards` 字段，而是用下面这组字段：

```json
{
	"id": "ppt-editable-launch",
	"meta": {
		"id": "ppt-editable-launch",
		"title": "把任何网页变成可编辑的PPT",
		"subtitle": "超级麦吉做到了 🔥",
		"tags": "#PPT神器 #AI办公 #效率工具",
		"author": "@超级麦吉",
		"feedTitle": "🔥重磅！把任何网页变成可编辑PPT，元素级还原",
		"feedLikes": "23.8w",
		"commentCount": "3.2k",
		"time": "4 分钟前"
	},
	"article": "超级麦吉PPT导出功能上线.html",
	"heroCover": "assets/cover-hero.jpg",
	"thumbnailCover": "assets/cover-square.jpg"
}
```

字段职责：

1. `article`：当前 post 的单篇 HTML 正文，相对 post 目录解析。
2. `heroCover`：封面列表中用于大图位的横图，相对 post 目录解析。
3. `thumbnailCover`：封面列表中右侧方图位用的小图，相对 post 目录解析。
4. `meta.time`：可选，封面卡片右上角显示的相对时间（如"4 分钟前"）；不填则回退到 i18n 文案"刚刚 / Just now"。

`SelfMediaPostManifest` 保留 `cards?` 供其他平台使用；对于微信公众号只需填写上面三个新字段即可，`cards` 可以省略。解析后的 `SelfMediaPost` 上会得到对应的 `article / heroCover / thumbnailCover` 三个 `SelfMediaCard`（含 `fileId`）。

## 运行时加载模型

当前加载链路分成两层。

### 第 1 层：加载根索引

`useSelfMediaPosts` 先读取根目录中的 `magic.project.js`，得到：

1. 声明的平台集合（`platforms`）
2. 每个平台的 `posts[]` 入口
3. 当前激活平台（默认声明顺序的第一个，可通过 `activePlatform` 切换）

此时 UI 已经可以：

1. 渲染平台壳子。
2. 渲染 post 切换器。
3. 用 `posts[].name` 展示占位标题。

### 第 2 层：按需加载 post 内容

只有当前激活的 post，才会继续去请求对应的 `post.json`。

加载规则：

1. 初次进入时，只加载当前 active post。
2. 用户切换到另一个 post 时，再加载那个 post。
3. 已经加载过的 post 会缓存在内存中，避免重复请求。
4. 导出 ZIP 前会调用 `ensureAllPostsLoaded()`，确保所有 post 都已完整加载。

这意味着：

1. `magic.project.js` 很轻。
2. 预览器首屏更快。
3. post 数量增加时扩展性更好。

## 卡片渲染链路

`CardFrame` 不再直接把 HTML 塞进原生 `iframe srcDoc`。

现在的标准链路是：

1. 通过 `fileId` 获取卡片 HTML 下载地址。
2. 拉取原始 HTML 文本。
3. 调用 `processHtmlContent()` 预处理资源路径。
4. 把处理后的 HTML 直接写入 `iframe srcDoc`。
5. 卡片的导出截图由宿主侧 `CardFrame.capture()` 调用 `snapdom` 完成。

这样做的原因是：卡片内容本身已经通过 `processHtmlContent()` 完成资源路径修正，导出时也不再依赖 iframe 内部的 `postMessage` 自截图链路。

## 导出截图链路

导出时，`useExportZip` 会优先调用每张卡片的 `capture()`：

1. 宿主侧读取 iframe 的实际内容尺寸
2. 导出前把已支持的 Font Awesome 图标临时替换为内联 SVG
3. 使用 `snapdom` 直接对 iframe body 截图生成 PNG
4. 截图完成后恢复原始 DOM
5. 父层把所有图片打包成 ZIP

如果 iframe 内自截图失败，则回退到宿主侧 `html-to-image.toPng(iframeElement)`。

## 平台视图矩阵

不同平台的视图 Tab 不一定四个都出现，各平台按需覆盖：

| 平台 | 视图 Tab | 说明 |
| --- | --- | --- |
| `rednote` | feed / detail / scroll / edit | 卡片流 + 详情手机壳 + 长图滚动 + 卡片编辑 |
| `instagram` | feed / detail / edit | 类似 rednote，无 scroll |
| `wechat-official-accounts` | feed（封面） / detail（全文内容） / edit（编辑） | 封面视图以手机壳呈现 |

`ViewTabs` 支持通过 `order` prop 指定本平台可见的视图顺序，微信公众号传入 `["feed", "detail", "edit"]`。

## 微信公众号封面视图特性

`feed` 视图专门还原了微信「订阅号消息」列表的样式：

1. 外层使用 `PhoneShell`（393×852）+ 状态栏 + 自绘顶部导航栏（返回 / 公众号 / 搜索 / 个人头像）。
2. 列表中每条 post 都渲染成同一篇文章的「双样式」卡片：
   - 账号行：品牌绿圆角头像（取 `author` 首字母）+ 作者名 + 右侧相对时间。
   - 大图区：`heroCover` 按 16:9 裁切，底部深色渐变覆盖 `feedTitle`。
   - 副卡区：左侧 `title`（2 行省略）+ 右侧 72×72 方形 `thumbnailCover`。
3. 两个点击热区（大图 / 副卡）都会切换到该 post 的 `detail` 视图。
4. 列表项启用 `IntersectionObserver` 懒加载，首屏外的 post 延迟请求 `post.json`。

`detail` 与 `edit` 视图不套手机壳，直接铺满内容区，便于 HTML 长文阅读与编辑。

## 平台扩展方式

新增平台时，按下面顺序处理：

1. 在 `Detail/types.ts` 的 `SelfMediaPlatform` 中加入新平台值。
2. 新建 `platforms/<platform>/Shell.tsx`
3. 新建 `platforms/<platform>/tokens.ts`
4. 新建 `platforms/<platform>/index.ts`
5. 在 `platforms/index.ts` 里注册平台组件。

如果平台还未注册，系统会自动回退到 `UnsupportedPlatform`。

## 新增 post 的建议步骤

1. 在 `posts/<post-id>/` 下创建 `post.json`
2. 在 `posts/<post-id>/cards/` 下放入卡片 HTML（微信公众号改为放单篇 `article.html` + `assets/` 下两张封面图）
3. 在 `post.json` 中维护 `meta` 和 `cards`（微信公众号改为维护 `meta` + `article` / `heroCover` / `thumbnailCover`）
4. 在根 `magic.project.js` 中追加一条 `{ id, name, entry }`

## 注意事项

1. `magic.project.js` 不要再内联完整 `meta` 和 `cards`。
2. `post.json` 文件名当前规范固定为 `post.json`，不要再使用 `magic.post.js`。
3. `cards` / `article` / `heroCover` / `thumbnailCover` 中的路径都必须是相对当前 post 目录的路径。
4. 如果卡片/正文依赖相对资源，必须确保这些资源能在附件树中被找到，否则运行时无法解析。
5. 切换 post 时如果看到占位内容，通常意味着该 post 还没被懒加载完成。
6. 微信公众号平台只读 `article` / `heroCover` / `thumbnailCover`，填写 `cards` 也不会生效；其他平台反之。
