package eventbus_test

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"

	"magic/pkg/eventbus"
)

// ==================== 事件定义示例 ====================

// UserCreatedPayload 用户创建事件的 payload
type UserCreatedPayload struct {
	UserID   int64
	Username string
	Email    string
}

// UserCreatedPayloadLite 用于测试同名事件类型冲突
type UserCreatedPayloadLite struct {
	UserID int64
}

// OrderPlacedPayload 订单创建事件的 payload
type OrderPlacedPayload struct {
	OrderID    string
	CustomerID int64
	TotalPrice float64
	Items      []OrderItem
}

// OrderItem 订单项
type OrderItem struct {
	ProductID string
	Quantity  int
	Price     float64
}

// ==================== 辅助函数 ====================

// newUserCreatedEvent 创建用户创建事件（避免全局变量）
func newUserCreatedEvent() eventbus.Event[UserCreatedPayload] {
	return eventbus.NewEvent[UserCreatedPayload]("user.created")
}

// newOrderPlacedEvent 创建订单事件（避免全局变量）
func newOrderPlacedEvent() eventbus.Event[OrderPlacedPayload] {
	return eventbus.NewEvent[OrderPlacedPayload]("order.placed")
}

// ==================== 测试用例 ====================

func TestEvent_Name(t *testing.T) {
	t.Parallel()
	event := newUserCreatedEvent()
	if event.Name() != "user.created" {
		t.Errorf("expected 'user.created', got '%s'", event.Name())
	}
}

func TestEnvelope_Basic(t *testing.T) {
	t.Parallel()
	event := newUserCreatedEvent()
	payload := UserCreatedPayload{
		UserID:   123,
		Username: "alice",
		Email:    "alice@example.com",
	}

	env := eventbus.NewEnvelope(event, payload)

	// 验证类型安全：直接访问字段，无需类型断言
	if env.Payload.UserID != 123 {
		t.Errorf("expected UserID 123, got %d", env.Payload.UserID)
	}
	if env.Payload.Username != "alice" {
		t.Errorf("expected Username 'alice', got '%s'", env.Payload.Username)
	}
	if env.Timestamp.IsZero() {
		t.Error("Timestamp should not be zero")
	}
}

func TestEnvelope_Metadata(t *testing.T) {
	t.Parallel()
	event := newUserCreatedEvent()
	payload := UserCreatedPayload{UserID: 1}
	env := eventbus.NewEnvelope(event, payload)

	// 添加元数据（不可变）
	env2 := env.WithMetadata("trace_id", "abc123")
	env3 := env2.WithMetadata("source", "api")

	// 验证原始信封未被修改
	if _, ok := env.GetMetadata("trace_id"); ok {
		t.Error("original envelope should not have metadata")
	}

	// 验证新信封有元数据
	if v, ok := env3.GetMetadata("trace_id"); !ok || v != "abc123" {
		t.Errorf("expected trace_id 'abc123', got '%s'", v)
	}
	if v, ok := env3.GetMetadata("source"); !ok || v != "api" {
		t.Errorf("expected source 'api', got '%s'", v)
	}
}

func TestBus_SubscribePublish_TypeSafe(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()
	var received UserCreatedPayload
	var mu sync.Mutex

	_, err := eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		mu.Lock()
		defer mu.Unlock()
		// 类型安全：直接访问 payload 字段
		received = env.Payload
		return nil
	})
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}

	payload := UserCreatedPayload{
		UserID:   456,
		Username: "bob",
		Email:    "bob@example.com",
	}
	env := eventbus.NewEnvelope(event, payload)

	if err := eventbus.Publish(bus, env); err != nil {
		t.Fatalf("publish failed: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if received.UserID != 456 {
		t.Errorf("expected UserID 456, got %d", received.UserID)
	}
	if received.Username != "bob" {
		t.Errorf("expected Username 'bob', got '%s'", received.Username)
	}
}

func TestBus_MultipleEvents_TypeSafe(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	userEvent := newUserCreatedEvent()
	orderEvent := newOrderPlacedEvent()

	var userCount, orderCount int32

	// 订阅用户事件
	_, _ = eventbus.Subscribe(bus, userEvent, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		atomic.AddInt32(&userCount, 1)
		return nil
	})

	// 订阅订单事件
	_, _ = eventbus.Subscribe(bus, orderEvent, func(env *eventbus.EventEnvelope[OrderPlacedPayload]) error {
		atomic.AddInt32(&orderCount, 1)
		// 类型安全：直接访问嵌套结构
		if len(env.Payload.Items) > 0 {
			_ = env.Payload.Items[0].ProductID
		}
		return nil
	})

	// 发布用户事件
	_ = eventbus.Publish(bus, eventbus.NewEnvelope(userEvent, UserCreatedPayload{UserID: 1}))
	_ = eventbus.Publish(bus, eventbus.NewEnvelope(userEvent, UserCreatedPayload{UserID: 2}))

	// 发布订单事件
	_ = eventbus.Publish(bus, eventbus.NewEnvelope(orderEvent, OrderPlacedPayload{
		OrderID: "ORD-001",
		Items:   []OrderItem{{ProductID: "PROD-1", Quantity: 2, Price: 9.99}},
	}))

	if atomic.LoadInt32(&userCount) != 2 {
		t.Errorf("expected userCount 2, got %d", userCount)
	}
	if atomic.LoadInt32(&orderCount) != 1 {
		t.Errorf("expected orderCount 1, got %d", orderCount)
	}
}

func TestBus_Priority(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()
	var order []int
	var mu sync.Mutex

	// 低优先级
	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		mu.Lock()
		defer mu.Unlock()
		order = append(order, 3)
		return nil
	}, eventbus.SubscribeOptions{Priority: 0})

	// 高优先级
	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		mu.Lock()
		defer mu.Unlock()
		order = append(order, 1)
		return nil
	}, eventbus.SubscribeOptions{Priority: 100})

	// 中优先级
	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		mu.Lock()
		defer mu.Unlock()
		order = append(order, 2)
		return nil
	}, eventbus.SubscribeOptions{Priority: 50})

	_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))

	mu.Lock()
	defer mu.Unlock()
	if len(order) != 3 || order[0] != 1 || order[1] != 2 || order[2] != 3 {
		t.Errorf("expected order [1,2,3], got %v", order)
	}
}

func TestBus_Once(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()
	var count int32

	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		atomic.AddInt32(&count, 1)
		return nil
	}, eventbus.SubscribeOptions{Once: true})

	// 发布两次
	_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))
	_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))

	if atomic.LoadInt32(&count) != 1 {
		t.Errorf("expected count 1, got %d", count)
	}
}

func TestBus_StopPropagation(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()
	var count int32

	// 高优先级，停止传播
	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		atomic.AddInt32(&count, 1)
		return eventbus.ErrStopPropagation
	}, eventbus.SubscribeOptions{Priority: 100})

	// 低优先级，不应被调用
	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		atomic.AddInt32(&count, 1)
		return nil
	}, eventbus.SubscribeOptions{Priority: 0})

	_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))

	if atomic.LoadInt32(&count) != 1 {
		t.Errorf("expected count 1, got %d", count)
	}
}

func TestBus_Unsubscribe(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()
	var count int32

	id, _ := eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		atomic.AddInt32(&count, 1)
		return nil
	})

	_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))

	if !bus.Unsubscribe(event.Name(), id) {
		t.Error("unsubscribe should return true")
	}

	_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))

	if atomic.LoadInt32(&count) != 1 {
		t.Errorf("expected count 1, got %d", count)
	}
}

func TestBus_AsyncWithPool(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		bus := eventbus.NewWithConfig(&eventbus.Config{
			WorkerCount: 2,
			QueueSize:   10,
		})
		defer bus.Close()

		event := newUserCreatedEvent()
		var count int32

		_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
			atomic.AddInt32(&count, 1)
			return nil
		}, eventbus.SubscribeOptions{Async: true})

		_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))
		_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))
		_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))
		synctest.Wait()

		if atomic.LoadInt32(&count) != 3 {
			t.Errorf("expected count 3, got %d", count)
		}
	})
}

func TestBus_PublishAsync(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		bus := eventbus.New()
		defer bus.Close()

		event := newUserCreatedEvent()
		var count int32

		_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
			atomic.AddInt32(&count, 1)
			return nil
		})
		_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
			atomic.AddInt32(&count, 1)
			return nil
		})

		_ = eventbus.PublishAsync(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))
		synctest.Wait()

		if atomic.LoadInt32(&count) != 2 {
			t.Errorf("expected count 2, got %d", count)
		}
	})
}

func TestBus_PanicRecovery(t *testing.T) {
	t.Parallel()
	var errorCalled atomic.Int32

	bus := eventbus.NewWithConfig(&eventbus.Config{
		OnError: func(name string, err error) {
			errorCalled.Add(1)
			if !errors.Is(err, eventbus.ErrPanic) {
				t.Errorf("expected ErrPanic, got %v", err)
			}
		},
	})
	defer bus.Close()

	event := newUserCreatedEvent()

	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		triggerNilPointerDerefForBusTest()
		return nil
	})

	_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))

	if errorCalled.Load() != 1 {
		t.Error("onError should be called on panic")
	}
}

func triggerNilPointerDerefForBusTest() {
	var ptr *int
	_ = *ptr
}

func TestBus_HandlerNil(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()

	_, err := eventbus.Subscribe[UserCreatedPayload](bus, event, nil)
	if !errors.Is(err, eventbus.ErrHandlerNil) {
		t.Errorf("expected ErrHandlerNil, got %v", err)
	}
}

func TestBus_HasHandlers(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()

	if bus.HasHandlers(event.Name()) {
		t.Error("should have no handlers initially")
	}

	id, _ := eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		return nil
	})

	if !bus.HasHandlers(event.Name()) {
		t.Error("should have handlers after subscribe")
	}

	bus.Unsubscribe(event.Name(), id)

	if bus.HasHandlers(event.Name()) {
		t.Error("should have no handlers after unsubscribe")
	}
}

func TestBus_HandlerCount(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()

	if bus.HandlerCount(event.Name()) != 0 {
		t.Error("should have 0 handlers initially")
	}

	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		return nil
	})
	_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		return nil
	})

	if bus.HandlerCount(event.Name()) != 2 {
		t.Errorf("expected 2 handlers, got %d", bus.HandlerCount(event.Name()))
	}
}

func TestBus_EventNames(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	userEvent := newUserCreatedEvent()
	orderEvent := newOrderPlacedEvent()

	_, _ = eventbus.Subscribe(bus, userEvent, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		return nil
	})
	_, _ = eventbus.Subscribe(bus, orderEvent, func(env *eventbus.EventEnvelope[OrderPlacedPayload]) error {
		return nil
	})

	names := bus.EventNames()
	if len(names) != 2 {
		t.Errorf("expected 2 event names, got %d", len(names))
	}
}

func TestBus_Clear(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	userEvent := newUserCreatedEvent()
	orderEvent := newOrderPlacedEvent()

	_, _ = eventbus.Subscribe(bus, userEvent, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		return nil
	})
	_, _ = eventbus.Subscribe(bus, orderEvent, func(env *eventbus.EventEnvelope[OrderPlacedPayload]) error {
		return nil
	})

	bus.Clear()

	if len(bus.EventNames()) != 0 {
		t.Error("should have no event names after clear")
	}
}

func TestBus_Close(t *testing.T) {
	t.Parallel()
	bus := eventbus.NewWithConfig(&eventbus.Config{
		WorkerCount: 1,
		QueueSize:   1,
	})

	event := newUserCreatedEvent()

	if bus.IsClosed() {
		t.Error("should not be closed initially")
	}

	bus.Close()

	if !bus.IsClosed() {
		t.Error("should be closed after Close()")
	}

	// 关闭后发布应返回错误
	err := eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))
	if !errors.Is(err, eventbus.ErrBusClosed) {
		t.Errorf("expected ErrBusClosed, got %v", err)
	}
}

func TestBus_DoubleClose(t *testing.T) {
	t.Parallel()
	bus := eventbus.NewWithConfig(&eventbus.Config{
		WorkerCount: 1,
		QueueSize:   1,
	})

	bus.Close()
	bus.Close() // 不应 panic
}

func TestBus_SubscribeAfterClose(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	bus.Close()

	event := newUserCreatedEvent()
	_, err := eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		return nil
	})
	if !errors.Is(err, eventbus.ErrBusClosed) {
		t.Errorf("expected ErrBusClosed, got %v", err)
	}
}

func TestBus_SubscribeEventTypeMismatch(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	eventA := eventbus.NewEvent[UserCreatedPayload]("user.created.same-name")
	eventB := eventbus.NewEvent[UserCreatedPayloadLite]("user.created.same-name")

	_, err := eventbus.Subscribe(bus, eventA, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		return nil
	})
	if err != nil {
		t.Fatalf("first subscribe failed: %v", err)
	}

	_, err = eventbus.Subscribe(bus, eventB, func(env *eventbus.EventEnvelope[UserCreatedPayloadLite]) error {
		return nil
	})
	if !errors.Is(err, eventbus.ErrEventTypeMismatch) {
		t.Errorf("expected ErrEventTypeMismatch, got %v", err)
	}
}

func TestBus_PublishEventTypeMismatch(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	eventA := eventbus.NewEvent[UserCreatedPayload]("user.created.same-name")
	eventB := eventbus.NewEvent[UserCreatedPayloadLite]("user.created.same-name")

	_, err := eventbus.Subscribe(bus, eventA, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		return nil
	})
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}

	err = eventbus.Publish(bus, eventbus.NewEnvelope(eventB, UserCreatedPayloadLite{UserID: 1}))
	if !errors.Is(err, eventbus.ErrEventTypeMismatch) {
		t.Errorf("expected ErrEventTypeMismatch, got %v", err)
	}
}

func TestBus_PublishNilEnvelope(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	err := eventbus.Publish[UserCreatedPayload](bus, nil)
	if !errors.Is(err, eventbus.ErrEnvelopeNil) {
		t.Errorf("expected ErrEnvelopeNil, got %v", err)
	}
}

func TestBus_PublishAsyncNilEnvelope(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	err := eventbus.PublishAsync[UserCreatedPayload](bus, nil)
	if !errors.Is(err, eventbus.ErrEnvelopeNil) {
		t.Errorf("expected ErrEnvelopeNil, got %v", err)
	}
}

func TestBus_OnceConcurrentPublish(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()
	var count int32

	_, err := eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
		atomic.AddInt32(&count, 1)
		return nil
	}, eventbus.SubscribeOptions{Once: true})
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}

	const goroutineCount = 100
	var wg sync.WaitGroup
	wg.Add(goroutineCount)

	for range goroutineCount {
		go func() {
			defer wg.Done()
			_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))
		}()
	}
	wg.Wait()

	if atomic.LoadInt32(&count) != 1 {
		t.Errorf("expected count 1, got %d", count)
	}
}

func TestBus_AsyncQueueFullFallbackToSync(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var onErrorCount int32
		queueFull := make(chan struct{}, 1)
		bus := newQueueFullFallbackBus(&onErrorCount, queueFull)
		defer bus.Close()

		event := newUserCreatedEvent()
		var count int32
		started := make(chan struct{}, 1)
		release := make(chan struct{})
		processed := make(chan int64, 3)

		_, err := eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
			atomic.AddInt32(&count, 1)
			if env.Payload.UserID == 0 {
				started <- struct{}{}
				<-release
			}
			processed <- env.Payload.UserID
			return nil
		}, eventbus.SubscribeOptions{Async: true})
		if err != nil {
			t.Fatalf("subscribe failed: %v", err)
		}

		if err := eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{UserID: 0})); err != nil {
			t.Fatalf("publish failed: %v", err)
		}
		synctest.Wait()
		<-started

		publishUserCreatedOrFatal(t, bus, event, 1)
		publishUserCreatedOrFatal(t, bus, event, 2)
		synctest.Wait()

		<-queueFull
		close(release)
		synctest.Wait()

		for range 3 {
			<-processed
		}

		if atomic.LoadInt32(&count) != 3 {
			t.Errorf("expected count %d, got %d", 3, count)
		}
		if atomic.LoadInt32(&onErrorCount) == 0 {
			t.Error("expected queue full backpressure signal")
		}
	})
}

func newQueueFullFallbackBus(onErrorCount *int32, queueFull chan<- struct{}) *eventbus.Bus {
	return eventbus.NewWithConfig(&eventbus.Config{
		WorkerCount: 1,
		QueueSize:   1,
		OnError: func(name string, err error) {
			if errors.Is(err, eventbus.ErrQueueFull) {
				atomic.AddInt32(onErrorCount, 1)
				select {
				case queueFull <- struct{}{}:
				default:
				}
			}
		},
	})
}

func publishUserCreatedOrFatal(t *testing.T, bus *eventbus.Bus, event eventbus.Event[UserCreatedPayload], userID int64) {
	t.Helper()
	if err := eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{UserID: userID})); err != nil {
		t.Fatalf("publish failed: %v", err)
	}
}

func TestBus_PublishAsyncEnvelopeIsolation(t *testing.T) {
	t.Parallel()
	const (
		listenerA = "listener_a"
		listenerB = "listener_b"
	)

	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()
	env := eventbus.NewEnvelope(event, UserCreatedPayload{UserID: 1}).WithMetadata("trace_id", "abc")

	start := make(chan struct{})
	var ready atomic.Int32
	results := make(chan string, 2)

	_, err := eventbus.Subscribe(bus, event, func(e *eventbus.EventEnvelope[UserCreatedPayload]) error {
		e.Metadata["shared"] = listenerA
		if ready.Add(1) == 2 {
			close(start)
		}
		<-start
		results <- e.Metadata["shared"]
		return nil
	})
	if err != nil {
		t.Fatalf("subscribe listener_a failed: %v", err)
	}

	_, err = eventbus.Subscribe(bus, event, func(e *eventbus.EventEnvelope[UserCreatedPayload]) error {
		e.Metadata["shared"] = listenerB
		if ready.Add(1) == 2 {
			close(start)
		}
		<-start
		results <- e.Metadata["shared"]
		return nil
	})
	if err != nil {
		t.Fatalf("subscribe listener_b failed: %v", err)
	}

	if err = eventbus.PublishAsync(bus, env); err != nil {
		t.Fatalf("publish async failed: %v", err)
	}

	gotA := <-results
	gotB := <-results

	if (gotA != listenerA || gotB != listenerB) && (gotA != listenerB || gotB != listenerA) {
		t.Errorf("expected isolated metadata values, got [%s, %s]", gotA, gotB)
	}

	if _, ok := env.Metadata["shared"]; ok {
		t.Error("original envelope metadata should not be mutated by listeners")
	}
}

// ==================== 并发测试 ====================

func TestBus_ConcurrentSubscribePublish(t *testing.T) {
	t.Parallel()
	bus := eventbus.New()
	defer bus.Close()

	event := newUserCreatedEvent()
	var wg sync.WaitGroup
	var count int32

	// 并发订阅
	for range 10 {
		wg.Go(func() {
			_, _ = eventbus.Subscribe(bus, event, func(env *eventbus.EventEnvelope[UserCreatedPayload]) error {
				atomic.AddInt32(&count, 1)
				return nil
			})
		})
	}

	wg.Wait()

	// 并发发布
	for range 100 {
		wg.Go(func() {
			_ = eventbus.Publish(bus, eventbus.NewEnvelope(event, UserCreatedPayload{}))
		})
	}

	wg.Wait()

	// 每次发布触发 10 个处理器，共 100 次发布
	expected := int32(10 * 100)
	if atomic.LoadInt32(&count) != expected {
		t.Errorf("expected count %d, got %d", expected, count)
	}
}
