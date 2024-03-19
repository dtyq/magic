# Listener Registry

这个目录用于集中管理 `superMagicStore` 使用的内存型 listener registry。

## 文件说明

- `topic-message-listener-registry.ts`
  - 基于 `topicId` 分桶的底层消息监听 registry
  - 用于原始消息到达或消息状态更新通知
  - 适合仍然需要直接读取消息结构的场景

- `domain-event-registry.ts`
  - 通用的高层领域事件 registry
  - 统一负责所有领域事件的注册、匹配和派发

- `crew-domain-event-registry.ts` / `task-domain-event-registry.ts`
  - 仅保留各自领域事件的 payload / 状态类型定义

- `crew-domain-event-resolver.ts` / `task-domain-event-resolver.ts`
  - 各自维护 matcher / resolver，把原始消息解析成业务语义事件

- `index.ts`
  - 对本目录下的 registry 做统一导出

## 职责边界

以下场景适合使用 topic listener：

- 调用方需要直接访问原始消息 payload
- 行为仍然天然绑定在某个 `topicId`
- 当前还没有形成稳定的领域语义抽象

以下场景适合使用 domain event：

- store 已经可以从原始消息中识别业务事件
- UI 更应该响应业务含义，而不是传输层消息细节
- 触发逻辑不应该依赖单个选中的 `topicId`

## 当前用法

- `superMagicStore` 会继续派发 topic message listener，用于原始消息到达或更新通知
- `superMagicStore` 会把原始消息依次交给各个 resolver，命中后通过统一 domain event registry 派发
