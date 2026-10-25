# DOM 树性能日志使用说明

## 适用场景

当 HTML 编辑器的 DOM 树面板在大数据量或复杂嵌套内容下出现滚动卡顿、展开缓慢、节点 hover 延迟时，可以使用这套日志收集数据。

日志复用 `ManualPerfLogger`，默认关闭。未开启时不会向控制台输出 DOM 树性能日志。

## 开始采集

打开浏览器开发者工具，在 Console 中执行：

```js
window.enableManualPerfLogger()
window.localStorage.setItem("manualPerfLoggerEnabled:consoleDebug", "true")
window.startManualPerfSession({ source: "dom-tree-scroll" })
```

然后执行以下操作：

1. 打开 HTML 编辑器的 DOM 树面板。
2. 等待 DOM 树加载完成。
3. 从顶部滚动到底部，再从底部滚动回顶部。
4. 展开一个深层节点，重复滚动操作。
5. 如果卡顿只在 hover 节点时出现，移动鼠标经过几行节点。

建议每次只采集一个主要问题，单次采集时间控制在 30 秒以内，方便区分不同场景。

## 导出日志

复现完成后执行：

```js
window.finishManualPerfSession({ source: "dom-tree-scroll" })
window.getManualPerfSummary()
window.exportManualPerfLogs()
```

`getManualPerfSummary()` 会在控制台输出耗时聚合结果。

`exportManualPerfLogs()` 会返回完整 JSON，并尝试复制到剪贴板。复制失败时仍可以在 Console 中查看返回值并手动复制。

如果只需要查看原始日志：

```js
window.getManualPerfLogs()
```

## DOM 树指标

| 指标                          | 含义                                               | 主要判断方向                             |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------- |
| `dom_tree_refresh`            | 从面板请求 DOM 快照到请求结束的耗时                | 判断 iframe bridge 或 DOM 快照生成是否慢 |
| `dom_tree_index`              | 构建 `nodeMap`、`parentMap` 和 selector 索引的耗时 | 判断主线程数据索引是否阻塞               |
| `dom_tree_visible_rows`       | 计算展开状态下可见行的耗时                         | 判断可见行计算是否过重                   |
| `dom_tree_virtual_range`      | 虚拟列表总行数、当前挂载行数和滚动区间             | 判断是否挂载过多行或区间异常             |
| `dom_tree_hover_bridge_batch` | 一段时间内 hover 和 clear bridge 调用次数          | 判断 hover 通信是否过于频繁              |
| `long_task_count`             | 超过阈值的主线程长任务                             | 判断是否存在渲染或脚本阻塞               |

`dom_tree_virtual_range` 的数据示例：

```json
{
	"first_index": 120,
	"is_scrolling": true,
	"last_index": 137,
	"mounted_row_count": 18,
	"total_row_count": 346,
	"total_size_px": 11072
}
```

## 快速判断

### `dom_tree_refresh` 很高

优先检查 iframe runtime 的 DOM 快照生成、bridge 请求和 iframe 主线程任务。此时继续调整 React 虚拟行通常不能解决主要问题。

### `dom_tree_refresh` 正常，但 `long_task_count` 增加

说明请求本身不慢，卡顿更可能来自主线程渲染、React 提交、浮层组件或其他页面任务。结合卡顿时间点查看 `dom_tree_virtual_range`。

### `mounted_row_count` 明显过大

检查虚拟列表的 `overscan`、初始测量高度和拖拽源节点保留逻辑。正常情况下挂载行数应明显小于 `total_row_count`。

### `dom_tree_hover_bridge_batch` 中 clear 调用很多

说明鼠标经过虚拟行时可能触发了频繁的 hover 状态切换或 bridge 通信，需要进一步检查滚动期间是否仍然触发 hover 事件。

### `dom_tree_index` 或 `dom_tree_visible_rows` 很高

说明数据处理本身占用了主线程。只有在节点数量继续扩大、并且这些指标稳定超过一帧预算时，才考虑把纯数据快照的索引计算迁移到 Worker；Worker 不应直接操作 iframe DOM。

## 数据边界

本次 DOM 树日志只记录数量、索引、状态和耗时，不记录 HTML 内容、selector、文件路径或节点文本。日志保存在 `ManualPerfLogger` 的内存缓冲区中，达到上限后会丢弃最早记录。

采集结束后可以关闭：

```js
window.disableManualPerfLogger()
window.localStorage.removeItem("manualPerfLoggerEnabled:consoleDebug")
```
