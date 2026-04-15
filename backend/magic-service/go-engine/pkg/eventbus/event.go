// Package eventbus 提供类型安全的泛型发布-订阅事件系统
package eventbus

import (
	"maps"
	"time"
)

// Event 表示类型安全的事件定义
// T 是事件携带的 payload 类型，必须是具体的结构体类型
// 使用示例：
//
//	var UserCreatedEvent = eventbus.NewEvent[UserCreatedPayload]("user.created") // 示例
//	type UserCreatedPayload struct { // 示例
//	    UserID   int64 // 示例
//	    Username string // 示例
//	} // 示例
type Event[T any] struct {
	name string
}

// NewEvent 创建一个新的类型安全事件定义
func NewEvent[T any](name string) Event[T] {
	return Event[T]{name: name}
}

// Name 返回事件名称
func (e Event[T]) Name() string {
	return e.name
}

// EventEnvelope 是事件的运行时封装，包含 payload 和元数据
type EventEnvelope[T any] struct {
	// Event 是事件定义
	Event Event[T]

	// Payload 是类型安全的事件数据
	Payload T

	// Timestamp 是事件创建时间
	Timestamp time.Time

	// Metadata 可选的元数据（如来源、追踪ID等）
	Metadata map[string]string
}

// NewEnvelope 创建事件信封
func NewEnvelope[T any](event Event[T], payload T) *EventEnvelope[T] {
	return &EventEnvelope[T]{
		Event:     event,
		Payload:   payload,
		Timestamp: time.Now(),
	}
}

// WithMetadata 添加元数据并返回新的信封（不可变）
func (e *EventEnvelope[T]) WithMetadata(key, value string) *EventEnvelope[T] {
	newMeta := make(map[string]string, len(e.Metadata)+1)
	maps.Copy(newMeta, e.Metadata)
	newMeta[key] = value

	return &EventEnvelope[T]{
		Event:     e.Event,
		Payload:   e.Payload,
		Timestamp: e.Timestamp,
		Metadata:  newMeta,
	}
}

// GetMetadata 获取元数据
func (e *EventEnvelope[T]) GetMetadata(key string) (string, bool) {
	if e.Metadata == nil {
		return "", false
	}
	v, ok := e.Metadata[key]
	return v, ok
}

// Handler 是类型安全的事件处理器
type Handler[T any] func(*EventEnvelope[T]) error

// SubscribeOptions 配置订阅行为
type SubscribeOptions struct {
	Priority int  // 越大越先执行
	Once     bool // 仅执行一次后自动移除
	Async    bool // 通过工作池异步执行
}
