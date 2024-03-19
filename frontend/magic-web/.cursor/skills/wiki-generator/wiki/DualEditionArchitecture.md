# 开源版与商业版隔离架构说明

本文说明 Magic Web 当前的双版本架构如何工作，以及团队在不同开发场景下应该把代码落到哪一侧。先讲第一性原则：**这个仓库不是维护两套并行应用，而是维护一套共享基线，再用商业覆盖层补充差异**。

## 一句话结论

- `src/opensource/` 是共享基线，也是默认实现。
- `enterprise/src/opensource/` 是商业覆盖层，路径需要与共享基线保持镜像。
- 企业版构建时优先解析 `enterprise/src/...`，找不到时自动回落到 `src/...`。
- 少量差异不一定要整页覆盖，也可以通过组件注册和函数覆盖在运行时注入。

## 架构总览

```mermaid
flowchart TD
    A[开发者导入 @/opensource/...]
    B{当前 Edition}
    C[Open Source Vite Config]
    D[Enterprise Vite Config]
    E[vite-plugin-enterprise-overlay]
    F[解析到 enterprise/src/opensource/...]
    G[回落到 src/opensource/...]
    H[应用启动]
    I[默认组件 / 默认函数]
    J[商业版运行时注册覆盖]

    A --> B
    B -->|opensource| C
    B -->|enterprise| D
    D --> E
    E -->|存在镜像文件| F
    E -->|不存在镜像文件| G
    C --> G
    F --> H
    G --> H
    H --> I
    H -->|isCommercial()| J
```

这张图对应了三层机制：

1. **版本选择层**：由 `EDITION` 决定当前使用开源版还是商业版 Vite 配置。
2. **文件解析层**：企业版通过 overlay 插件优先命中 `enterprise/src/...`，否则回退到 `src/...`。
3. **运行时扩展层**：对于局部差异，可以在应用启动时注册商业组件或覆盖默认函数，而不必复制整页代码。

## 为什么这样设计

如果把开源版和商业版做成两套独立应用，问题会很快出现：

- 公共能力会重复维护
- 页面与 Hook 容易长期漂移
- 缺陷修复需要双写
- 评审时很难看出真正的商业差异

当前架构的目标刚好相反：

- **共享收敛**：公共逻辑尽量只保留在 `src/opensource/`
- **差异隔离**：商业能力只放在 `enterprise/` 及其镜像目录
- **最小覆盖**：能覆盖一个 Hook，就不要覆盖整页
- **稳定导入**：调用方尽量始终导入 `@/opensource/...`

## 目录职责

### `src/opensource/`

共享基线目录。双版本都依赖它，默认实现都应该优先收敛到这里。页面、组件、hooks、services、stores、types、utils 等共享代码都应以这里为源头。

### `enterprise/src/opensource/`

商业镜像覆盖目录。只有当商业版行为与共享基线不同，才在这里放同相对路径文件。它的职责不是复制一套代码，而是**只承载差异**。

### `enterprise/`

企业版入口壳层。这里除了 `src/opensource` 覆盖实现外，还承载企业版入口 HTML、企业静态资源覆盖、企业构建根目录等能力。

## 三层实现机制

### 1. 构建时选择版本

默认脚本是企业版：

- `pnpm dev` 实际等价于 `pnpm dev:enterprise`
- `pnpm build` 实际等价于 `pnpm build:enterprise`
- 显式运行 `pnpm dev:opensource` 才会只看开源版
- `pnpm dev:all` 适合同时观察两边行为

这意味着，开发前先确认你要验证的是哪一边，否则容易在错误的 edition 下误判结果。

### 2. 解析时企业优先、开源兜底

企业版 Vite 配置会挂载 `vite-plugin-enterprise-overlay`。该插件会把逻辑导入路径先映射到 `enterprise/src/...`，找不到再映射到 `src/...`。因此对调用方来说，最稳定的写法是始终导入：

```ts
import useSomething from "@/opensource/..."
```

而不是在业务代码里自己写条件分支区分 edition。

### 3. 运行时注册局部差异

如果差异只是一个组件或一个函数，不需要复制整个页面：

- 组件差异走 `ComponentFactory`
- 函数差异走 `FunctionHub`

企业版启动时会在 `isCommercial()` 为真时注册商业组件和商业函数，从而覆盖共享默认实现。

## 开发决策表

| 场景 | 应该修改哪里 | 推荐机制 | 说明 |
| --- | --- | --- | --- |
| 纯共享能力，开源版和商业版都要生效 | `src/opensource/` | 共享基线 | 例如通用类型、公共 Hook、共享 UI、共享 service |
| 商业版独有能力，且依赖企业私有接口或能力 | `enterprise/src/opensource/` 或 `enterprise/` | 镜像覆盖 | 例如企业协作、付费、组织能力、企业入口页 |
| 大页面里只有一小块 UI 或行为不同 | `src/opensource/` + `enterprise/src/opensource/` | 提取最小可变点 | 先抽子组件/Hook，再只覆盖那一小块 |
| 某个渲染组件在商业版需要替换 | `src/opensource/components/ComponentRender/*` + 商业注册区 | 组件注册覆盖 | 默认组件在共享层，商业组件启动时注册替换 |
| 某个函数行为在商业版不同 | `src/opensource/services/common/FunctionHub/*` + 商业注册区 | 函数覆盖 | 默认函数先注册，商业版再 override |
| 企业入口 HTML、企业静态资源不同 | `enterprise/`、`enterprise/public` | 入口/资源覆盖 | 不需要污染共享业务代码 |
| 修改了共享接口、返回值或 Hook 结构 | 两边都要改 | 契约同步 | 共享基线和商业镜像必须一起对齐 |
| 某功能开源版不提供，但共享调用方仍会 import | 两边都要改 | 开源 stub + 商业真实实现 | 开源侧返回 no-op，商业侧提供完整能力 |

## 典型开发场景

### 场景 1：新增一个双版本都可用的通用功能

落点：只改 `src/opensource/`

适用情况：

- 不依赖商业私有 API
- 开源版本身就应该可运行
- 商业版只是复用这份能力

做法：

1. 把实现放进 `src/opensource/...`
2. 调用方统一使用 `@/opensource/...`
3. 只在确实存在商业差异时，再增加 `enterprise/src/opensource/...` 镜像文件

### 场景 2：新增一个商业版独有功能

落点：优先改 `enterprise/src/opensource/...`

适用情况：

- 功能本身不属于开源基线
- 依赖企业私有 client、store、service 或业务域
- 只希望在商业版中生效

做法：

1. 先确认调用方的稳定路径是否应该仍然是 `@/opensource/...`
2. 若是，则在 `enterprise/src/opensource/...` 下创建镜像实现
3. 如果共享层调用方也会 import 这个模块，则在 `src/opensource/...` 提供同接口 stub
4. 开源 stub 只保留最小安全返回值，不复制商业逻辑

### 场景 3：共享页面中只有一小块内容不同

落点：两边都改，但只改最小可变点

这是最容易做错的场景。错误做法是复制整页到 `enterprise/src/opensource/...`。更好的方式是：

1. 先从共享页面里抽出一个子组件或 Hook
2. 把这个子组件或 Hook 放到 `src/opensource/...`
3. 给开源版一个最小默认实现，例如 `null`、`false`、空数组、空函数
4. 再在 `enterprise/src/opensource/...` 提供同路径真实实现

这样可以让大页面继续共享，只把真正变化的那一小段隔离出来。

### 场景 4：商业版只需要替换某个渲染组件

落点：共享默认组件 + 商业注册

适用情况：

- 调用点本身已经走 `ComponentFactory`
- 差异体现在渲染视图，而不是整个调用链

做法：

1. 在 `src/opensource/components/ComponentRender/config/defaultComponents.tsx` 中定义默认组件
2. 在 `enterprise/src/opensource/premium/components/index.ts` 中注册商业替换组件
3. 让调用方继续走工厂读取组件，不直接 import 商业实现

### 场景 5：商业版只需要替换某个函数行为

落点：共享默认函数 + 商业 override

适用情况：

- 差异主要是行为函数，不是完整 UI 模块
- 共享层已经存在统一调用入口

做法：

1. 在共享层注册默认函数
2. 在企业启动阶段调用 `functionHub.override(...)`
3. 保持调用方不关心当前是开源实现还是商业实现

### 场景 6：修改了共享契约

落点：通常两边都要改

下面这些改动都属于“契约改动”：

- Hook 返回值结构变化
- 组件 props 变化
- service 参数或返回值变化
- 菜单项数据结构变化

因为商业镜像经常依赖共享接口，所以这类改动如果只改一边，最终通常会在企业版运行时报错，或在开源版降级失效。

## 仓库里的两个真实例子

### 例子 1：开源 stub + 商业完整实现

`useCollaboratorUpdatePanel` 在开源侧只是一个 no-op stub，返回空协作者列表、关闭的协作状态和空节点；而企业侧在同路径下提供完整协作管理弹窗和数据逻辑。这就是典型的“开源保接口，商业给能力”。

适用启发：

- 共享页面仍然可以稳定 import
- 开源版不会因为缺少企业能力而构建失败
- 商业版通过 overlay 自动拿到真实实现

### 例子 2：共享菜单基线 + 商业菜单扩展

`useWorkspaceActionMenu` 在开源侧只提供 rename 和 delete，而企业侧在同路径扩展了 transfer。这里说明：**当返回结构属于共享契约时，后续如果你改菜单数据结构，两边都要同步**。

## 开发时的边界守则

开发新功能时，优先遵守下面几条：

1. `src/opensource/` 不要直接 import 商业代码
2. 新增双版本模块时，优先稳定在 `@/opensource/...` 导入路径
3. 能覆盖最小子模块，就不要覆盖整页
4. 商业 overlay 文件必须与共享文件保持同相对路径
5. 开源 stub 必须和商业真实实现保持相同接口
6. 如果改了共享契约，必须检查对应的企业镜像是否也要同步

## 当前仓库中的历史性例外

从现状看，仓库目标架构已经比较明确，但仍存在少量历史边界泄漏。这些例外不应该继续扩散。对新需求而言，应继续遵守“共享基线 + 镜像覆盖 + 最小 override”的目标模式，而不是新增共享层反向依赖商业层的代码。

## 推荐开发流程

1. 先判断该功能属于共享能力还是商业差异
2. 再判断差异是“整模块不同”还是“局部差异”
3. 优先让调用方稳定导入 `@/opensource/...`
4. 若需要商业差异，再决定是 overlay、组件注册，还是函数覆盖
5. 最后分别用 `pnpm dev:opensource` 和 `pnpm dev:enterprise` 验证边界是否正确

## 团队协作建议

- 评审共享代码时，重点看它是否意外引入了商业依赖
- 评审商业代码时，重点看它是否真的只承载差异
- 评审大页面改动时，优先追问是否可以下沉为更小的 Hook 或子组件
- 评审接口改动时，默认检查企业镜像和开源 stub 是否同步

## Sources: 资料来源：

- `package.json` (6-16, 30-30)
- `enterprise/README.md` (1-27)
- `vite/edition.ts` (5-44)
- `vite/config/opensource/index.ts` (5-47)
- `vite/config/enterprise/index.ts` (7-115)
- `plugins/vite-plugin-enterprise-overlay.ts` (5-162)
- `enterprise/src/opensource/main.tsx` (1-53)
- `enterprise/src/opensource/premium/components/index.ts` (1-30)
- `enterprise/src/opensource/premium/functions/index.ts` (1-17)
- `src/opensource/components/ComponentRender/ComponentFactory.ts` (1-85)
- `src/opensource/components/ComponentRender/config/defaultComponents.tsx` (1-62)
- `src/opensource/services/common/FunctionHub/registerDefault.ts` (1-39)
- `src/opensource/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel.tsx` (1-33)
- `enterprise/src/opensource/pages/superMagic/components/WithCollaborators/hooks/useCollaboratorUpdatePanel.tsx` (1-116)
- `src/opensource/pages/superMagic/hooks/useWorkspaceActionMenu.tsx` (1-90)
- `enterprise/src/opensource/pages/superMagic/hooks/useWorkspaceActionMenu.tsx` (1-116)
- `.agents/skills/dual-edition-module-migration/SKILL.md` (16-55, 57-176, 214-460)
