// Package eventbus 提供类型安全的泛型发布-订阅事件系统
package eventbus

import (
	"cmp"
	"errors"
	"fmt"
	"maps"
	"reflect"
	"slices"
	"sync"
	"sync/atomic"
)

// 错误定义
var (
	// ErrHandlerNil 当处理器为 nil 时返回
	ErrHandlerNil = errors.New("handler cannot be nil")

	// ErrEnvelopeNil 当事件信封为 nil 时返回
	ErrEnvelopeNil = errors.New("event envelope cannot be nil")

	// ErrEventTypeMismatch 当同名事件的 payload 类型不一致时返回
	ErrEventTypeMismatch = errors.New("event payload type mismatch")

	// ErrInternalInvariant 当 eventbus 内部不变量被破坏时返回
	ErrInternalInvariant = errors.New("eventbus internal invariant violated")

	// ErrPanic 当处理器发生 panic 时返回
	ErrPanic = errors.New("panic in handler")

	// ErrQueueFull 当异步队列已满时返回
	ErrQueueFull = errors.New("event queue is full")

	// ErrStopPropagation 用于停止事件传播的哨兵错误
	ErrStopPropagation = errors.New("stop propagation")

	// ErrBusClosed 当事件总线已关闭时返回
	ErrBusClosed = errors.New("event bus is closed")
)

// Config 配置事件总线
type Config struct {
	// WorkerCount 异步工作池大小，0 表示不使用工作池
	WorkerCount int

	// QueueSize 异步队列大小
	QueueSize int

	// OnError 错误回调，用于处理异步执行中的错误
	OnError func(eventName string, err error)
}

// Bus 是类型安全的事件总线
// 使用泛型函数 Subscribe 和 Publish 来确保类型安全
type Bus struct {
	mu       sync.RWMutex
	handlers map[string][]*handlerRecord // eventName -> handlers（事件名到处理器）
	types    map[string]reflect.Type     // eventName -> payload type（事件名到 payload 类型）
	nextID   atomic.Uint64

	// 异步工作池
	jobs    chan asyncJob
	wg      sync.WaitGroup
	onError func(string, error)
	sendMu  sync.RWMutex
	asyncWg sync.WaitGroup

	// 关闭状态
	closed atomic.Bool
}

// handlerRecord 存储处理器记录（使用 any 存储，在调用时类型转换）
type handlerRecord struct {
	id       uint64
	fn       any // Handler[T] 的类型擦除存储
	priority int
	once     bool
	async    bool
	fired    atomic.Bool
}

// asyncJob 异步任务
type asyncJob struct {
	eventName string
	envelope  any // *EventEnvelope[T] 的类型擦除存储
	record    *handlerRecord
	invoker   func(any, *handlerRecord) (bool, error) // 类型安全的调用器
}

// New 使用默认配置创建事件总线
func New() *Bus {
	return NewWithConfig(nil)
}

// NewWithConfig 使用配置创建事件总线
func NewWithConfig(cfg *Config) *Bus {
	if cfg == nil {
		cfg = &Config{}
	}

	b := &Bus{
		handlers: make(map[string][]*handlerRecord),
		types:    make(map[string]reflect.Type),
		onError:  cfg.OnError,
	}

	// 启动工作池
	if cfg.WorkerCount > 0 && cfg.QueueSize > 0 {
		b.jobs = make(chan asyncJob, cfg.QueueSize)
		b.wg.Add(cfg.WorkerCount)
		for range cfg.WorkerCount {
			go b.worker()
		}
	}

	return b
}

// worker 工作池 goroutine
func (b *Bus) worker() {
	defer b.wg.Done()
	for job := range b.jobs {
		stop, err := job.invoker(job.envelope, job.record)
		b.reportError(job.eventName, err)
		if job.record != nil && job.record.once {
			b.removeByID(job.eventName, job.record.id)
		}
		// 异步模式下忽略 stop 信号（因为处理器是并发执行的）
		_ = stop
	}
}

// Subscribe 订阅事件（类型安全）
func Subscribe[T any](b *Bus, event Event[T], handler Handler[T], opts ...SubscribeOptions) (uint64, error) {
	if handler == nil {
		return 0, ErrHandlerNil
	}

	var opt SubscribeOptions
	if len(opts) > 0 {
		opt = opts[0]
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	if b.closed.Load() {
		return 0, ErrBusClosed
	}

	payloadType := payloadTypeOf[T]()
	if err := b.validateEventTypeLocked(event.name, payloadType); err != nil {
		return 0, err
	}

	id := b.nextID.Add(1)
	rec := &handlerRecord{
		id:       id,
		fn:       handler,
		priority: opt.Priority,
		once:     opt.Once,
		async:    opt.Async,
	}

	list := b.handlers[event.name]
	list = append(list, rec)
	// 按优先级降序排序
	slices.SortStableFunc(list, func(a, b *handlerRecord) int {
		return cmp.Compare(b.priority, a.priority)
	})
	b.handlers[event.name] = list

	return id, nil
}

// Unsubscribe 取消订阅
func (b *Bus) Unsubscribe(eventName string, id uint64) bool {
	return b.removeByID(eventName, id)
}

// removeByID 根据 ID 移除处理器
func (b *Bus) removeByID(eventName string, id uint64) bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	list, ok := b.handlers[eventName]
	if !ok {
		return false
	}

	for i := range list {
		if list[i].id == id {
			list = append(list[:i], list[i+1:]...)
			if len(list) == 0 {
				delete(b.handlers, eventName)
				delete(b.types, eventName)
				return true
			}
			b.handlers[eventName] = list
			return true
		}
	}
	return false
}

// removeByIDs 批量移除处理器
func (b *Bus) removeByIDs(eventName string, ids []uint64) {
	if len(ids) == 0 {
		return
	}

	idSet := make(map[uint64]struct{}, len(ids))
	for _, id := range ids {
		idSet[id] = struct{}{}
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	list := b.handlers[eventName]
	if len(list) == 0 {
		return
	}

	filtered := list[:0]
	for _, r := range list {
		if _, found := idSet[r.id]; !found {
			filtered = append(filtered, r)
		}
	}

	if len(filtered) == 0 {
		delete(b.handlers, eventName)
		delete(b.types, eventName)
		return
	}

	b.handlers[eventName] = filtered
}

// HasHandlers 检查事件是否有处理器
func (b *Bus) HasHandlers(eventName string) bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.handlers[eventName]) > 0
}

// HandlerCount 返回指定事件的处理器数量
func (b *Bus) HandlerCount(eventName string) int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.handlers[eventName])
}

// EventNames 返回所有有处理器的事件名称
func (b *Bus) EventNames() []string {
	b.mu.RLock()
	defer b.mu.RUnlock()

	names := make([]string, 0, len(b.handlers))
	for name, handlers := range b.handlers {
		if len(handlers) > 0 {
			names = append(names, name)
		}
	}
	slices.Sort(names)
	return names
}

// Publish 同步发布事件（类型安全）
func Publish[T any](b *Bus, envelope *EventEnvelope[T]) error {
	eventName, err := validatePublishInput(b, envelope)
	if err != nil {
		return err
	}

	list := b.snapshotHandlers(eventName)
	if len(list) == 0 {
		return nil
	}

	invoker := makeInvoker[T](eventName)

	var onceIDs []uint64

	for _, rec := range list {
		if !tryAcquireOnce(rec) {
			continue
		}

		enqueued, enqueueErr := enqueueAsync(b, eventName, cloneEnvelope(envelope), rec, invoker)
		if enqueueErr != nil {
			return enqueueErr
		}
		if enqueued {
			continue
		}

		stop, invokeErr := invokeTyped(eventName, envelope, rec)
		b.reportError(eventName, invokeErr)
		if rec.once {
			onceIDs = append(onceIDs, rec.id)
		}
		if stop {
			break
		}
	}

	if len(onceIDs) > 0 {
		b.removeByIDs(eventName, onceIDs)
	}

	return nil
}

// PublishAsync 异步发布事件（所有处理器并发执行）
func PublishAsync[T any](b *Bus, envelope *EventEnvelope[T]) error {
	eventName, err := validatePublishInput(b, envelope)
	if err != nil {
		return err
	}

	list := b.snapshotHandlers(eventName)
	if len(list) == 0 {
		return nil
	}

	if b.jobs != nil {
		return publishAsyncWithPool(b, eventName, envelope, list)
	}

	for _, rec := range list {
		if !tryAcquireOnce(rec) {
			continue
		}
		spawnAsync(b, eventName, rec, cloneEnvelope(envelope))
	}

	return nil
}

// invokeTyped 类型安全地调用处理器（包级泛型函数，Go 不支持泛型方法）
func invokeTyped[T any](eventName string, envelope *EventEnvelope[T], rec *handlerRecord) (bool, error) {
	handler, ok := rec.fn.(Handler[T])
	if !ok {
		return false, fmt.Errorf(
			"%w: event=%q, invalid handler type %T",
			ErrInternalInvariant,
			eventName,
			rec.fn,
		)
	}

	err := callHandler(handler, envelope)
	if err == nil {
		return false, nil
	}
	if errors.Is(err, ErrStopPropagation) {
		return true, nil
	}
	return false, err
}

// Clear 清除所有处理器
func (b *Bus) Clear() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers = make(map[string][]*handlerRecord)
	b.types = make(map[string]reflect.Type)
}

// Close 关闭事件总线
func (b *Bus) Close() {
	if b.closed.Swap(true) {
		return // 已经关闭
	}

	b.waitSubscriptionsToDrain()

	b.sendMu.Lock()
	if b.jobs != nil {
		close(b.jobs)
	}
	b.sendMu.Unlock()

	if b.jobs != nil {
		b.wg.Wait()
	}
	b.asyncWg.Wait()
}

// IsClosed 返回事件总线是否已关闭
func (b *Bus) IsClosed() bool {
	return b.closed.Load()
}

func payloadTypeOf[T any]() reflect.Type {
	return reflect.TypeFor[T]()
}

func (b *Bus) validateEventType(eventName string, payloadType reflect.Type) error {
	b.mu.RLock()
	defer b.mu.RUnlock()

	registeredType, ok := b.types[eventName]
	if !ok || registeredType == payloadType {
		return nil
	}

	return fmt.Errorf(
		"%w: event=%q, registered=%s, current=%s",
		ErrEventTypeMismatch,
		eventName,
		registeredType.String(),
		payloadType.String(),
	)
}

func (b *Bus) validateEventTypeLocked(eventName string, payloadType reflect.Type) error {
	registeredType, ok := b.types[eventName]
	if !ok {
		b.types[eventName] = payloadType
		return nil
	}
	if registeredType == payloadType {
		return nil
	}

	return fmt.Errorf(
		"%w: event=%q, registered=%s, current=%s",
		ErrEventTypeMismatch,
		eventName,
		registeredType.String(),
		payloadType.String(),
	)
}

func (b *Bus) enqueue(job asyncJob) (bool, error) {
	b.sendMu.RLock()
	defer b.sendMu.RUnlock()

	if b.closed.Load() {
		return false, ErrBusClosed
	}

	select {
	case b.jobs <- job:
		return true, nil
	default:
		return false, nil
	}
}

func cloneEnvelope[T any](src *EventEnvelope[T]) *EventEnvelope[T] {
	if src == nil {
		return nil
	}

	dst := *src
	if len(src.Metadata) > 0 {
		dst.Metadata = maps.Clone(src.Metadata)
	}

	return &dst
}

func validatePublishInput[T any](b *Bus, envelope *EventEnvelope[T]) (string, error) {
	if b.closed.Load() {
		return "", ErrBusClosed
	}
	if envelope == nil {
		return "", ErrEnvelopeNil
	}

	eventName := envelope.Event.name
	if err := b.validateEventType(eventName, payloadTypeOf[T]()); err != nil {
		return "", err
	}

	return eventName, nil
}

func (b *Bus) snapshotHandlers(eventName string) []*handlerRecord {
	b.mu.RLock()
	defer b.mu.RUnlock()

	src := b.handlers[eventName]
	return slices.Clone(src)
}

func makeInvoker[T any](eventName string) func(any, *handlerRecord) (bool, error) {
	return func(env any, rec *handlerRecord) (bool, error) {
		envelope, ok := env.(*EventEnvelope[T])
		if !ok {
			return false, fmt.Errorf(
				"%w: event=%q, invalid envelope type %T",
				ErrInternalInvariant,
				eventName,
				env,
			)
		}
		return invokeTyped(eventName, envelope, rec)
	}
}

func tryAcquireOnce(rec *handlerRecord) bool {
	if !rec.once {
		return true
	}
	return rec.fired.CompareAndSwap(false, true)
}

func enqueueAsync[T any](
	b *Bus,
	eventName string,
	envelope *EventEnvelope[T],
	rec *handlerRecord,
	invoker func(any, *handlerRecord) (bool, error),
) (bool, error) {
	if !rec.async || b.jobs == nil {
		return false, nil
	}

	enqueued, err := b.enqueue(asyncJob{
		eventName: eventName,
		envelope:  envelope,
		record:    rec,
		invoker:   invoker,
	})
	if err != nil {
		if rec.once {
			rec.fired.Store(false)
		}
		return false, err
	}
	if enqueued {
		return true, nil
	}

	b.reportQueueFull(eventName)
	return false, nil
}

func publishAsyncWithPool[T any](
	b *Bus,
	eventName string,
	envelope *EventEnvelope[T],
	list []*handlerRecord,
) error {
	invoker := makeInvoker[T](eventName)

	for _, rec := range list {
		if !tryAcquireOnce(rec) {
			continue
		}

		enqueued, err := enqueueAsync(b, eventName, cloneEnvelope(envelope), rec, invoker)
		if err != nil {
			return err
		}
		if enqueued {
			continue
		}

		spawnAsync(b, eventName, rec, cloneEnvelope(envelope))
	}

	return nil
}

func spawnAsync[T any](b *Bus, eventName string, rec *handlerRecord, envelope *EventEnvelope[T]) {
	b.asyncWg.Add(1)
	go func(r *handlerRecord, env *EventEnvelope[T]) {
		defer b.asyncWg.Done()
		_, err := invokeTyped(eventName, env, r)
		b.reportError(eventName, err)
		if r.once {
			b.removeByID(eventName, r.id)
		}
	}(rec, envelope)
}

func callHandler[T any](handler Handler[T], envelope *EventEnvelope[T]) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("%w: %v", ErrPanic, r)
		}
	}()

	return handler(envelope)
}

func (b *Bus) waitSubscriptionsToDrain() {
	b.mu.Lock()
	defer b.mu.Unlock()

	// 作为关闭屏障，等待并发中的 Subscribe 完成其临界区。
	_ = len(b.handlers)
}

func (b *Bus) reportError(eventName string, err error) {
	if err == nil || b.onError == nil {
		return
	}
	b.onError(eventName, err)
}

func (b *Bus) reportQueueFull(eventName string) {
	b.reportError(eventName, ErrQueueFull)
}
