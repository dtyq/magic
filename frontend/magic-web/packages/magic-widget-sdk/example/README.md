# Magic Widget SDK Example

一个独立的 [Bun](https://bun.sh) Web 服务，用于运行 Magic Widget SDK 的交互式示例页面（原 `frontend/magic-web/public/agent.html`）。页面提供 Widget 生命周期控制、界面配置表单、高级 `createWidgetOptions` JSON 编辑器、动态自定义 Mention 搜索回调与 iframe 实时预览。

连接相关配置（SDK 加载地址、crew、部署/组织码、登录策略）全部通过环境变量注入，不再硬编码在页面里。

## 前置条件

- [Bun](https://bun.sh) ≥ 1.3（`bun --version` 确认）

## 快速开始

```bash
cd frontend/magic-web/packages/magic-widget-sdk/example

# 1. 复制环境变量模板并填入真实值
cp .env.example .env

# 2. 安装类型依赖（可选，仅 typecheck 需要）
bun install

# 3. 启动服务
bun run dev
```

服务默认监听 `http://127.0.0.1:4318`，打开该地址即可看到示例页面。

- 健康检查：`curl http://127.0.0.1:4318/healthz`
- 页面：`http://127.0.0.1:4318/`

`dev` 脚本使用 `bun --watch` 运行：修改 `server.ts` 会自动重启进程；`index.html` 在每次请求时重新读取，改完刷新浏览器即可看到效果。`start` 为不带 watch 的启动方式。

## 环境变量

| 变量                               | 必填 | 默认值               | 说明                                                           |
| ---------------------------------- | ---- | -------------------- | -------------------------------------------------------------- |
| `WIDGET_EXAMPLE_HOST`              | 否   | `127.0.0.1`          | 服务监听地址                                                   |
| `WIDGET_EXAMPLE_PORT`              | 否   | `4318`               | 服务监听端口                                                   |
| `WIDGET_EXAMPLE_APP_URL`           | 是   | —                    | 已部署 magic-web 的源地址，服务从中加载 `/sdk/magic-widget.js` |
| `WIDGET_EXAMPLE_CREW_ID`           | 是   | —                    | 示例页面向导的 crew ID                                         |
| `WIDGET_EXAMPLE_DEPLOYMENT_CODE`   | 否   | —                    | 私有化部署码                                                   |
| `WIDGET_EXAMPLE_ORGANIZATION_CODE` | 否   | —                    | 组织码                                                         |
| `WIDGET_EXAMPLE_LOGIN_STRATEGY`    | 否   | `private_deployment` | 登录策略                                                       |

Bun 启动时会自动加载当前目录下的 `.env` 文件。

## 工作原理

服务端 `server.ts` 读取环境变量，在每次请求时重新读取 `index.html`（避免缓存模板），将其中的两个占位符替换为实际值后返回：

- `{{SDK_URL}}` → `${WIDGET_EXAMPLE_APP_URL}/sdk/magic-widget.js`（SDK 脚本地址）
- `{{EXAMPLE_ENV_JSON}}` → 序列化后的连接配置，写入 `window.__MAGIC_WIDGET_EXAMPLE_ENV__`

页面内联脚本读取 `window.__MAGIC_WIDGET_EXAMPLE_ENV__` 构造 `mount` 选项。SDK 的 iframe 源地址由 SDK 脚本来源推断，因此 `WIDGET_EXAMPLE_APP_URL` 必须指向一个已部署且可访问的 magic-web 环境，iframe 才能正常连到真实 Agent。

## 动态 Mention 搜索示例

页面默认配置包含静态 `panel.customGroups`。打开 iframe 的 `@` 面板后：

- 全局搜索可输入 `revenue`、`active users` 或 `dynamic report`，分别匹配丰富的图表/报告语义数据。
- 进入 `Business charts` 分组后可输入 `quarter`、`north region` 或 `dynamic chart`，验证分组 scope 和动态结果。
- 左侧 `Dynamic custom Mention search` 区域会显示 query、搜索 scope 和返回数量。

示例回调位于 `index.html` 的 `customMentionSearch`，返回项包含完整 `text`、`description` 和结构化 `data`。返回结果通过 `groupId` 关联静态分组，清空搜索后仍恢复静态列表。

### 手工验证被取消的搜索

回调对以 `slow` 开头的查询模拟 1.5 秒延迟，并像真实请求一样在收到 `signal` 时以 `AbortError` 结束：

1. 在 iframe 中打开 `@` 面板，输入 `slow report`，此时请求会挂起约 1.5 秒。
2. 在返回前把输入改成 `dynamic report`。
3. 预期：列表只显示 `Dynamic Report`；不出现 `Custom Mention search was aborted` 或重试按钮；底部的 `Dynamic custom Mention search` 状态只记录最新一次查询。

如果旧请求的迟到结果覆盖了新结果，或取消被渲染成失败态，就说明请求时序处理出现了回归。

## 目录结构

```text
example/
├── server.ts       # Bun.serve 服务，读取 env 并注入 index.html
├── index.html      # 示例页面（由 public/agent.html 改造而来）
├── package.json    # 独立 Bun 包声明
├── tsconfig.json   # typecheck 配置
├── .env.example    # 环境变量模板（fictional 占位值）
└── .gitignore
```
