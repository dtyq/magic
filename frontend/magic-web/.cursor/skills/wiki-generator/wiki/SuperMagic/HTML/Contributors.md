# HTML 模块贡献者分析（Git）

## 分析对象
- 路径：`src/opensource/pages/superMagic/components/Detail/contents/HTML`
- 统计时间范围：`2025-05-13` 至 `2026-03-04`
- 统计日期：`2026-03-09`

## 统计口径
- 提交总量约 `591`（包含 merge）。
- merge 提交约 `95`，因此同时给出含 merge 和去 merge 视角。
- 作者归并规则：
  - `Peter_Tan + Peter` 归并为 `Peter_Tan`
  - `蔡伦多` 的两个邮箱归并为同一人
- 当前代码归属使用 `git blame`，排除了 `dist`、锁文件、map、文档和 runtime 配置文件等非核心源码文件。

## 贡献频率（作者维度）

### 提交数（含 merge）
| 作者 | 提交数 |
|---|---:|
| Peter_Tan | 194 |
| seagull | 164 |
| zhiqi li | 94 |
| 蔡伦多 | 63 |
| chenyu | 41 |
| biubiukam | 35 |

### 提交数（去 merge）
| 作者 | 提交数 |
|---|---:|
| Peter_Tan | 180 |
| seagull | 143 |
| zhiqi li | 78 |
| 蔡伦多 | 44 |
| chenyu | 31 |
| biubiukam | 20 |

### 活跃度补充（含 merge）
| 作者 | 活跃天数 | 最近提交日期 | 近 90 天提交数 |
|---|---:|---|---:|
| Peter_Tan | 56 | 2025-09-18 | 0 |
| seagull | 48 | 2026-03-04 | 142 |
| zhiqi li | 48 | 2026-02-28 | 28 |
| 蔡伦多 | 43 | 2026-02-10 | 15 |
| chenyu | 18 | 2026-01-21 | 4 |
| biubiukam | 23 | 2025-12-10 | 1 |

## 时间演进（月度）
| 月份 | 提交数 |
|---|---:|
| 2025-05 | 29 |
| 2025-06 | 58 |
| 2025-07 | 85 |
| 2025-08 | 63 |
| 2025-09 | 62 |
| 2025-10 | 21 |
| 2025-11 | 70 |
| 2025-12 | 25 |
| 2026-01 | 135 |
| 2026-02 | 41 |
| 2026-03 | 2 |

阶段观察：
- `2025-05 ~ 2025-09`：以 `Peter_Tan` 为主导的基础壳层建设期。
- `2025-11`：`zhiqi li` 在 `utils/media/dashboard` 方向增强明显。
- `2026-01 ~ 2026-03`：`seagull` 主导 `HTMLEditorV2 + iframe-runtime + iframe-bridge + StylePanel/SelectionOverlay` 的体系化改造。

## 作者 × 模块贡献（历史改动量 add+del）

### 模块总改动量
| 模块 | 改动量 |
|---|---:|
| iframe-bridge | 24682 |
| utils | 23901 |
| core-shell | 16658 |
| iframe-runtime | 14221 |
| components | 13288 |
| media | 3682 |
| hooks | 3635 |
| dashboard | 2746 |
| docs | 912 |
| constants | 302 |

### 模块 owner 倾向（按改动量）
- `iframe-bridge`：`seagull` 绝对主导。
- `iframe-runtime`：`seagull` 绝对主导。
- `components`（StylePanel/SelectionOverlay 等）：`seagull` 绝对主导。
- `utils`：`zhiqi li`、`Peter_Tan`、`seagull` 三人共同持有。
- `core-shell`：`Peter_Tan` 与 `seagull` 双核心。
- `media/dashboard`：`zhiqi li` 主导。

## 当前代码归属（blame）
排除非核心文件后，当前源码行归属约为：

| 作者 | 行数 | 占比 |
|---|---:|---:|
| seagull | 24401 | 71.0% |
| zhiqi li | 6283 | 18.3% |
| Peter_Tan | 2950 | 8.6% |
| 蔡伦多 | 529 | 1.5% |
| chenyu | 138 | 0.4% |
| biubiukam | 81 | 0.2% |

模块级当前归属：
- `iframe-runtime / iframe-bridge / components / hooks`：以 `seagull` 为主。
- `media / dashboard`：以 `zhiqi li` 为主。
- `utils`：`zhiqi li + Peter_Tan + seagull` 共同维护。
- `core-shell`：多人重叠，历史包袱较重。

## 高频文件（重构优先关注）
| 文件 | 历史修改次数 | 参与作者数 |
|---|---:|---:|
| `index.tsx` | 204 | 6 |
| `IsolatedHTMLRenderer.tsx` | 131 | 6 |
| `utils.ts` | 101 | 4 |
| `htmlProcessor.ts` | 34 | 4 |
| `utils/full-content.ts` | 29 | 2 |

## 关键结论（面向重构接手）
- 当前阶段最核心联系人是 `seagull`，尤其涉及 runtime/bridge/selection/style 时应优先评审。
- 涉及 `media/dashboard` 与预览内容拼装时，`zhiqi li` 的历史上下文价值最高。
- `core-shell + utils` 是多人重叠和高 churn 区域，重构应先补契约测试再拆分。
- 单人高占比文件较多（如 runtime 相关），存在 bus factor 风险，建议在重构中同步做知识扩散与测试补强。

## 可持续维护建议
- 每次大版本重构后更新此文：提交频率、模块 owner、blame 占比三张表。
- 对 `index.tsx / IsolatedHTMLRenderer.tsx / utils.ts` 维护变更日志，减少隐式行为回归。
- 为 `iframe-runtime` 和 `utils` 建立最小回归用例清单，作为改造前置门槛。

## 按模块拆分的联系人清单（Review Routing）

> 说明：
> - `主联系人` 代表当前代码归属和近期活跃度最匹配的人选。
> - `备选联系人` 用于覆盖历史上下文或跨模块耦合场景。
> - 建议至少 `1 主 + 1 备` 双人评审，避免单点知识风险。

| 模块/范围 | 主联系人 | 备选联系人 | 建议评审关注点 |
|---|---|---|---|
| `iframe-runtime` | seagull | Peter_Tan | 命令执行链路、Selection 行为一致性、样式应用副作用、回归测试完整性 |
| `iframe-bridge` | seagull | Peter_Tan | message 协议兼容性、跨 iframe 边界条件、错误降级与重试策略 |
| `components/StylePanel` | seagull | zhiqi li | 样式面板状态同步、控件行为一致性、i18n 文案键完整性 |
| `components/SelectionOverlay` | seagull | Peter_Tan | 拖拽/缩放/旋转精度、缩放同步、滚动同步与性能抖动 |
| `hooks`（含 `useHTMLEditorV2`） | seagull | Peter_Tan | 生命周期与副作用隔离、跨模块调用时序、状态源单一性 |
| `utils`（通用） | zhiqi li | Peter_Tan / seagull | 工具函数边界、历史兼容分支、旧逻辑删除后的行为对齐 |
| `utils/full-content.ts` | zhiqi li | seagull | 内容拼装正确性、节点处理顺序、嵌套 iframe 场景兼容 |
| `media` | zhiqi li | seagull | 媒体资源处理、URL/拦截逻辑、预览与导出一致性 |
| `dashboard` | zhiqi li | seagull | 场景参数透传、渲染一致性、与主编辑流程耦合风险 |
| `core-shell`（`index.tsx`/`IsolatedHTMLRenderer.tsx`/`htmlProcessor.ts`） | seagull | Peter_Tan / zhiqi li | 入口装配、历史分支兼容、核心流程可观测性与回归覆盖 |
| `constants` | seagull | Peter_Tan | 常量变更的全链路影响、版本兼容与默认值安全性 |

### PR 分流建议（可直接执行）
1. 仅改 `iframe-runtime/iframe-bridge`：默认指定 `seagull` 必审。
2. 涉及 `media/dashboard/full-content`：默认指定 `zhiqi li` 必审。
3. 改 `core-shell` 或跨 2 个以上模块：`seagull +（Peter_Tan 或 zhiqi li）` 双必审。
4. 改 `utils` 且影响广：至少拉 `zhiqi li` 与一位 runtime 方向同学联合评审。
5. 大型重构 PR 建议拆分为“协议层 / 渲染层 / 业务层”三个批次，逐批合入并做回归。

### 交接期建议
- 在重构期间维护 `CODEOWNERS` 或团队约定表，将上表映射到目录级 owner。
- 对单人主导的关键文件（runtime、StylePanel、SelectionOverlay 核心 hooks）建立 pair review 机制。
- 每两周更新一次本节联系人（按最近 60 天活跃提交与 blame 变化微调）。
