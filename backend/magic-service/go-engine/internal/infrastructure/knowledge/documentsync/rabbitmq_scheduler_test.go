package documentsync_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"magic/internal/infrastructure/knowledge/documentsync"
	"magic/internal/infrastructure/logging"
)

const (
	rabbitTestKnowledgeBaseCode = "KB-1"
	rabbitTestDocumentCode      = "DOC-1"
	rabbitTestMaxRequeue        = 20
)

var (
	errRabbitFakeConsumerNotImplemented = errors.New("rabbit fake consumer not implemented")
	errRabbitRunnerFailed               = errors.New("rabbit runner failed")
	errRabbitPublishFailed              = errors.New("rabbit publish failed")
	errRabbitRetryStoreUnavailable      = errors.New("retry store unavailable")
	errRabbitNonRetryableResourceLimit  = errors.New("rabbit non-retryable resource limit")
	errRabbitPermanentFileFailure       = errors.New("rabbit permanent file failure")
	errRabbitOCRLimitFailure            = errors.New("rabbit ocr limit failure")
)

type rabbitRecordingRunner struct {
	mu       sync.Mutex
	executed []*documentsync.Task
	err      error
}

func (r *rabbitRecordingRunner) Run(_ context.Context, task *documentsync.Task) error {
	r.mu.Lock()
	r.executed = append(r.executed, documentsync.CloneTask(task))
	r.mu.Unlock()
	return r.err
}

func (r *rabbitRecordingRunner) Executed() []*documentsync.Task {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]*documentsync.Task(nil), r.executed...)
}

type rabbitPanicRunner struct{}

func (rabbitPanicRunner) Run(_ context.Context, _ *documentsync.Task) error {
	values := []string{}
	_ = values[time.Now().Nanosecond()]
	return nil
}

type rabbitTimeoutRunner struct{}

func (rabbitTimeoutRunner) Run(ctx context.Context, _ *documentsync.Task) error {
	<-ctx.Done()
	return fmt.Errorf("rabbit timeout runner context done: %w", ctx.Err())
}

type rabbitTerminalHandler struct {
	mu     sync.Mutex
	tasks  []*documentsync.Task
	causes []error
	err    error
}

func (h *rabbitTerminalHandler) HandleTerminalTask(_ context.Context, task *documentsync.Task, cause error) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.tasks = append(h.tasks, documentsync.CloneTask(task))
	h.causes = append(h.causes, cause)
	return h.err
}

func (h *rabbitTerminalHandler) Calls() ([]*documentsync.Task, []error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]*documentsync.Task(nil), h.tasks...), append([]error(nil), h.causes...)
}

type rabbitMemoryRetryStore struct {
	mu     sync.Mutex
	counts map[string]int
	resets []string
	err    error
}

func newRabbitMemoryRetryStore() *rabbitMemoryRetryStore {
	return &rabbitMemoryRetryStore{counts: make(map[string]int)}
}

func (s *rabbitMemoryRetryStore) Increment(_ context.Context, taskKey string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return 0, s.err
	}
	s.counts[taskKey]++
	return s.counts[taskKey], nil
}

func (s *rabbitMemoryRetryStore) Reset(_ context.Context, taskKey string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.err != nil {
		return s.err
	}
	delete(s.counts, taskKey)
	s.resets = append(s.resets, taskKey)
	return nil
}

func (s *rabbitMemoryRetryStore) Count(taskKey string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.counts[taskKey]
}

func (s *rabbitMemoryRetryStore) ResetCalls() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.resets...)
}

type rabbitFakeBroker struct {
	mu            sync.Mutex
	enabled       bool
	publishErr    error
	published     []documentsync.RabbitMQTaskMessage
	publishedQ    []string
	consumerCalls []rabbitConsumerCall
	newConsumer   func(context.Context, string, int, string) (documentsync.RabbitMQConsumer, error)
}

type rabbitConsumerCall struct {
	Queue       string
	Prefetch    int
	ConsumerTag string
}

func (b *rabbitFakeBroker) Enabled() bool {
	return b != nil && b.enabled
}

func (b *rabbitFakeBroker) PublishTask(_ context.Context, queue string, message documentsync.RabbitMQTaskMessage) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.publishErr != nil {
		return b.publishErr
	}
	b.publishedQ = append(b.publishedQ, queue)
	b.published = append(b.published, message)
	return nil
}

func (b *rabbitFakeBroker) NewConsumer(ctx context.Context, queue string, prefetch int, consumerTag string) (documentsync.RabbitMQConsumer, error) {
	if b == nil {
		return nil, errRabbitFakeConsumerNotImplemented
	}
	b.mu.Lock()
	b.consumerCalls = append(b.consumerCalls, rabbitConsumerCall{
		Queue:       queue,
		Prefetch:    prefetch,
		ConsumerTag: consumerTag,
	})
	b.mu.Unlock()
	if b.newConsumer != nil {
		return b.newConsumer(ctx, queue, prefetch, consumerTag)
	}
	return nil, errRabbitFakeConsumerNotImplemented
}

func (b *rabbitFakeBroker) PublishedMessages() []documentsync.RabbitMQTaskMessage {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]documentsync.RabbitMQTaskMessage(nil), b.published...)
}

func (b *rabbitFakeBroker) ConsumerCalls() []rabbitConsumerCall {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]rabbitConsumerCall(nil), b.consumerCalls...)
}

type rabbitFakeDelivery struct {
	body        []byte
	acked       bool
	nacked      bool
	nackRequeue bool
}

func (d *rabbitFakeDelivery) Body() []byte {
	return d.body
}

func (d *rabbitFakeDelivery) Ack(bool) error {
	d.acked = true
	return nil
}

func (d *rabbitFakeDelivery) Nack(_, requeue bool) error {
	d.nacked = true
	d.nackRequeue = requeue
	return nil
}

type rabbitFakeConsumer struct {
	deliveries chan documentsync.RabbitMQDelivery
	closeErr   error
	closeOnce  sync.Once
}

func (c *rabbitFakeConsumer) Deliveries() <-chan documentsync.RabbitMQDelivery {
	return c.deliveries
}

func (c *rabbitFakeConsumer) Close() error {
	c.closeOnce.Do(func() {
		if c.deliveries != nil {
			close(c.deliveries)
		}
	})
	return c.closeErr
}

type rabbitBlockingReadinessGate struct {
	ready       <-chan struct{}
	waitStarted chan struct{}
	startOnce   sync.Once
}

func (g *rabbitBlockingReadinessGate) WaitReady(ctx context.Context) error {
	g.startOnce.Do(func() {
		if g.waitStarted != nil {
			close(g.waitStarted)
		}
	})
	select {
	case <-g.ready:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("wait rabbit readiness gate: %w", ctx.Err())
	}
}

type rabbitBlockingAdmissionGate struct {
	release     <-chan struct{}
	waitStarted chan struct{}
	startOnce   sync.Once
}

func (g *rabbitBlockingAdmissionGate) Wait(ctx context.Context, _ *documentsync.Task) error {
	g.startOnce.Do(func() {
		if g.waitStarted != nil {
			close(g.waitStarted)
		}
	})
	select {
	case <-g.release:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("wait rabbit blocking admission gate: %w", ctx.Err())
	}
}

func TestRabbitMQSchedulerSchedulePublishesSelfContainedDocumentSyncTask(t *testing.T) {
	t.Parallel()

	broker := &rabbitFakeBroker{enabled: true}
	scheduler := newRabbitMQSchedulerForTest(t, &rabbitRecordingRunner{}, broker, nil)

	task := newRabbitMQDocumentSyncTask(t)
	scheduler.Schedule(context.Background(), task)

	published := broker.PublishedMessages()
	if len(published) != 1 {
		t.Fatalf("expected one task message, got %d", len(published))
	}
	got := published[0]
	if got.Kind != documentsync.TaskKindDocumentSync {
		t.Fatalf("expected kind document_sync, got %q", got.Kind)
	}
	if got.KnowledgeBaseCode != rabbitTestKnowledgeBaseCode || got.DocumentCode != rabbitTestDocumentCode || got.Mode != documentsync.ResyncModeForTest {
		t.Fatalf("unexpected message fields: %+v", got)
	}
	if got.Async == nil || !*got.Async {
		t.Fatalf("expected async=true, got %+v", got.Async)
	}
	if got.Payload == nil || len(*got.Payload) == 0 {
		t.Fatal("expected payload to be embedded in task message")
	}
	if got.Key == "" {
		t.Fatal("expected scheduler to assign a task key")
	}
}

func TestRabbitMQSchedulerScheduleLogsPublishFailureWithoutFallback(t *testing.T) {
	t.Parallel()

	broker := &rabbitFakeBroker{enabled: true, publishErr: errRabbitPublishFailed}
	runner := &rabbitRecordingRunner{}
	scheduler := newRabbitMQSchedulerForTest(t, runner, broker, nil)

	scheduler.Schedule(context.Background(), newRabbitMQDocumentSyncTask(t))

	if got := runner.Executed(); len(got) != 0 {
		t.Fatalf("expected publish failure not to fallback-run locally, got %#v", got)
	}
}

func TestRabbitMQSchedulerScheduleSkipsUnsupportedTaskWithoutFallback(t *testing.T) {
	t.Parallel()

	broker := &rabbitFakeBroker{enabled: true}
	runner := &rabbitRecordingRunner{}
	scheduler := newRabbitMQSchedulerForTest(t, runner, broker, nil)

	scheduler.Schedule(context.Background(), &documentsync.Task{
		Kind:              "project_file_change",
		KnowledgeBaseCode: rabbitTestKnowledgeBaseCode,
		Code:              rabbitTestDocumentCode,
		Mode:              documentsync.ResyncModeForTest,
		Async:             true,
		Payload:           []byte(`{"project_file_id":1}`),
	})

	if got := broker.PublishedMessages(); len(got) != 0 {
		t.Fatalf("expected unsupported task not to publish, got %#v", got)
	}
	if got := runner.Executed(); len(got) != 0 {
		t.Fatalf("expected unsupported task not to fallback-run locally, got %#v", got)
	}
}

func TestRabbitMQSchedulerHandleDeliveryRunsTaskAndAcks(t *testing.T) {
	t.Parallel()

	runner := &rabbitRecordingRunner{}
	retryStore := newRabbitMemoryRetryStore()
	scheduler := newRabbitMQSchedulerForTestWithOptions(
		t,
		runner,
		&rabbitFakeBroker{enabled: true},
		nil,
		rabbitSchedulerTestOptions{retryStore: retryStore},
	)
	task := newRabbitMQDocumentSyncTask(t)
	task.Key = "TASK-SUCCESS"
	_, _ = retryStore.Increment(context.Background(), task.Key)
	delivery := newRabbitTaskDelivery(t, task)

	scheduler.HandleDeliveryForTest(context.Background(), delivery)

	if !delivery.acked || delivery.nacked {
		t.Fatalf("expected ack without nack, got ack=%v nack=%v", delivery.acked, delivery.nacked)
	}
	executed := runner.Executed()
	if len(executed) != 1 {
		t.Fatalf("expected one runner call, got %d", len(executed))
	}
	if executed[0].Code != rabbitTestDocumentCode {
		t.Fatalf("expected %s, got %q", rabbitTestDocumentCode, executed[0].Code)
	}
	if got := retryStore.Count(task.Key); got != 0 {
		t.Fatalf("expected retry counter to be reset, got %d", got)
	}
	if got := retryStore.ResetCalls(); len(got) != 1 || got[0] != task.Key {
		t.Fatalf("expected retry reset for %q, got %#v", task.Key, got)
	}
}

func TestRabbitMQSchedulerHandleDeliveryWaitsForMemoryAdmission(t *testing.T) {
	t.Parallel()

	release := make(chan struct{})
	gate := &rabbitBlockingAdmissionGate{
		release:     release,
		waitStarted: make(chan struct{}),
	}
	runner := &rabbitRecordingRunner{}
	scheduler := newRabbitMQSchedulerForTestWithOptions(
		t,
		runner,
		&rabbitFakeBroker{enabled: true},
		nil,
		rabbitSchedulerTestOptions{admissionGate: gate},
	)
	delivery := newRabbitTaskDelivery(t, newRabbitMQDocumentSyncTask(t))

	done := make(chan struct{})
	go func() {
		scheduler.HandleDeliveryForTest(context.Background(), delivery)
		close(done)
	}()

	waitForRabbitSignal(t, gate.waitStarted)
	if delivery.acked || delivery.nacked {
		t.Fatalf("expected delivery to be held without ack/nack, got ack=%v nack=%v", delivery.acked, delivery.nacked)
	}
	if got := runner.Executed(); len(got) != 0 {
		t.Fatalf("expected runner not to start before admission, got %#v", got)
	}

	close(release)
	waitForRabbitSignal(t, done)
	if !delivery.acked || delivery.nacked {
		t.Fatalf("expected delivery acked after admission, got ack=%v nack=%v", delivery.acked, delivery.nacked)
	}
	if got := runner.Executed(); len(got) != 1 {
		t.Fatalf("expected runner to start after admission, got %d", len(got))
	}
}

func TestRabbitMQSchedulerHandleDeliveryNacksHeldTaskOnShutdown(t *testing.T) {
	t.Parallel()

	gate := &rabbitBlockingAdmissionGate{
		release:     make(chan struct{}),
		waitStarted: make(chan struct{}),
	}
	runner := &rabbitRecordingRunner{}
	scheduler := newRabbitMQSchedulerForTestWithOptions(
		t,
		runner,
		&rabbitFakeBroker{enabled: true},
		nil,
		rabbitSchedulerTestOptions{admissionGate: gate},
	)
	delivery := newRabbitTaskDelivery(t, newRabbitMQDocumentSyncTask(t))
	runCtx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		scheduler.HandleDeliveryForTest(runCtx, delivery)
		close(done)
	}()

	waitForRabbitSignal(t, gate.waitStarted)
	cancel()
	waitForRabbitSignal(t, done)
	if delivery.acked || !delivery.nacked || !delivery.nackRequeue {
		t.Fatalf("expected held delivery to nack requeue on shutdown, got ack=%v nack=%v requeue=%v", delivery.acked, delivery.nacked, delivery.nackRequeue)
	}
	if got := runner.Executed(); len(got) != 0 {
		t.Fatalf("expected runner not to start after shutdown, got %#v", got)
	}
}

func TestRabbitMQSchedulerHandleDeliverySkipsInvalidAndLegacyMessages(t *testing.T) {
	t.Parallel()

	cases := map[string][]byte{
		"malformed_json": []byte("{"),
		"legacy_wakeup": mustJSON(t, map[string]any{
			"wakeup_id":  "wake-1",
			"dedupe_key": "KB:DOC:resync",
			"task_kind":  documentsync.TaskKindDocumentSync,
		}),
		"missing_payload": mustJSON(t, map[string]any{
			"kind":                documentsync.TaskKindDocumentSync,
			"knowledge_base_code": rabbitTestKnowledgeBaseCode,
			"document_code":       rabbitTestDocumentCode,
			"mode":                documentsync.ResyncModeForTest,
			"async":               true,
		}),
		"unknown_kind": mustJSON(t, map[string]any{
			"kind":                "third_file_revectorize",
			"knowledge_base_code": rabbitTestKnowledgeBaseCode,
			"document_code":       rabbitTestDocumentCode,
			"mode":                documentsync.ResyncModeForTest,
			"async":               true,
			"payload":             map[string]any{"code": rabbitTestDocumentCode},
		}),
		"missing_fields": mustJSON(t, map[string]any{
			"kind":    documentsync.TaskKindDocumentSync,
			"mode":    documentsync.ResyncModeForTest,
			"async":   true,
			"payload": map[string]any{"code": rabbitTestDocumentCode},
		}),
	}

	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			runner := &rabbitRecordingRunner{}
			broker := &rabbitFakeBroker{enabled: true}
			scheduler := newRabbitMQSchedulerForTest(t, runner, broker, nil)
			delivery := &rabbitFakeDelivery{body: body}

			scheduler.HandleDeliveryForTest(context.Background(), delivery)

			if !delivery.acked || delivery.nacked {
				t.Fatalf("expected invalid message to be acked without nack, got ack=%v nack=%v", delivery.acked, delivery.nacked)
			}
			if got := runner.Executed(); len(got) != 0 {
				t.Fatalf("expected runner not to be called, got %#v", got)
			}
			if got := broker.PublishedMessages(); len(got) != 0 {
				t.Fatalf("expected no republish, got %#v", got)
			}
		})
	}
}

func TestRabbitMQSchedulerHandleDeliveryRunnerFailureRequeuesUntilLimit(t *testing.T) {
	t.Parallel()

	runner := &rabbitRecordingRunner{err: errRabbitRunnerFailed}
	terminal := &rabbitTerminalHandler{}
	broker := &rabbitFakeBroker{enabled: true}
	scheduler := newRabbitMQSchedulerForTest(t, runner, broker, terminal)
	task := newRabbitMQDocumentSyncTask(t)

	for attempt := 1; attempt <= rabbitTestMaxRequeue; attempt++ {
		delivery := newRabbitTaskDelivery(t, task)
		scheduler.HandleDeliveryForTest(context.Background(), delivery)

		if delivery.acked || !delivery.nacked || !delivery.nackRequeue {
			t.Fatalf("attempt %d: expected nack requeue without ack, got ack=%v nack=%v requeue=%v", attempt, delivery.acked, delivery.nacked, delivery.nackRequeue)
		}
		tasks, causes := terminal.Calls()
		if len(tasks) != 0 || len(causes) != 0 {
			t.Fatalf("attempt %d: expected no terminal call before retry exhaustion, got tasks=%d causes=%d", attempt, len(tasks), len(causes))
		}
	}

	delivery := newRabbitTaskDelivery(t, task)
	scheduler.HandleDeliveryForTest(context.Background(), delivery)

	if !delivery.acked || delivery.nacked {
		t.Fatalf("expected exhausted task to ack without nack, got ack=%v nack=%v", delivery.acked, delivery.nacked)
	}
	if got := broker.PublishedMessages(); len(got) != 0 {
		t.Fatalf("expected no retry/recovery publish, got %#v", got)
	}
	tasks, causes := terminal.Calls()
	if len(tasks) != 1 || len(causes) != 1 {
		t.Fatalf("expected one terminal call, got tasks=%d causes=%d", len(tasks), len(causes))
	}
	if tasks[0].Code != rabbitTestDocumentCode {
		t.Fatalf("expected terminal %s, got %q", rabbitTestDocumentCode, tasks[0].Code)
	}
	if !errors.Is(causes[0], errRabbitRunnerFailed) {
		t.Fatalf("expected terminal cause to wrap runner error, got %v", causes[0])
	}
}

func TestRabbitMQSchedulerHandleDeliveryNonRetryableFailureAcksAndTerminates(t *testing.T) {
	t.Parallel()

	retryStore := newRabbitMemoryRetryStore()
	terminal := &rabbitTerminalHandler{}
	runner := &rabbitRecordingRunner{err: fmt.Errorf("wrapped: %w", errRabbitNonRetryableResourceLimit)}
	scheduler := newRabbitMQSchedulerForTestWithOptions(
		t,
		runner,
		&rabbitFakeBroker{enabled: true},
		terminal,
		rabbitSchedulerTestOptions{
			retryStore: retryStore,
			nonRetryableError: func(err error) bool {
				return errors.Is(err, errRabbitNonRetryableResourceLimit)
			},
		},
	)
	task := newRabbitMQDocumentSyncTask(t)
	task.Key = "TASK-NON-RETRYABLE"
	delivery := newRabbitTaskDelivery(t, task)

	scheduler.HandleDeliveryForTest(context.Background(), delivery)

	if !delivery.acked || delivery.nacked {
		t.Fatalf("expected non-retryable failure to ack without nack, got ack=%v nack=%v", delivery.acked, delivery.nacked)
	}
	if got := retryStore.Count(task.Key); got != 0 {
		t.Fatalf("expected retry counter not to increment, got %d", got)
	}
	tasks, causes := terminal.Calls()
	if len(tasks) != 1 || len(causes) != 1 {
		t.Fatalf("expected one terminal call, got tasks=%d causes=%d", len(tasks), len(causes))
	}
	if !errors.Is(causes[0], errRabbitNonRetryableResourceLimit) {
		t.Fatalf("expected terminal cause to wrap resource limit, got %v", causes[0])
	}
}

func TestRabbitMQSchedulerDocumentFileFailureIsNonRetryable(t *testing.T) {
	t.Parallel()

	retryStore := newRabbitMemoryRetryStore()
	terminal := &rabbitTerminalHandler{}
	runner := &rabbitRecordingRunner{
		err: errRabbitPermanentFileFailure,
	}
	scheduler := newRabbitMQSchedulerForTestWithOptions(
		t,
		runner,
		&rabbitFakeBroker{enabled: true},
		terminal,
		rabbitSchedulerTestOptions{
			retryStore: retryStore,
			nonRetryableError: func(err error) bool {
				return errors.Is(err, errRabbitPermanentFileFailure)
			},
		},
	)
	task := newRabbitMQDocumentSyncTask(t)
	task.Key = "TASK-BAD-FILE"
	delivery := newRabbitTaskDelivery(t, task)

	scheduler.HandleDeliveryForTest(context.Background(), delivery)

	if !delivery.acked || delivery.nacked {
		t.Fatalf("expected file failure to ack without nack, got ack=%v nack=%v", delivery.acked, delivery.nacked)
	}
	if got := retryStore.Count(task.Key); got != 0 {
		t.Fatalf("expected retry counter not to increment, got %d", got)
	}
	tasks, causes := terminal.Calls()
	if len(tasks) != 1 || len(causes) != 1 {
		t.Fatalf("expected one terminal call, got tasks=%d causes=%d", len(tasks), len(causes))
	}
}

func TestRabbitMQSchedulerOCROverloadFailureStillRequeues(t *testing.T) {
	t.Parallel()

	retryStore := newRabbitMemoryRetryStore()
	terminal := &rabbitTerminalHandler{}
	runner := &rabbitRecordingRunner{
		err: errRabbitOCRLimitFailure,
	}
	scheduler := newRabbitMQSchedulerForTestWithOptions(
		t,
		runner,
		&rabbitFakeBroker{enabled: true},
		terminal,
		rabbitSchedulerTestOptions{
			retryStore: retryStore,
			nonRetryableError: func(err error) bool {
				return errors.Is(err, errRabbitPermanentFileFailure)
			},
		},
	)
	task := newRabbitMQDocumentSyncTask(t)
	task.Key = "TASK-OCR-OVERLOAD"
	delivery := newRabbitTaskDelivery(t, task)

	scheduler.HandleDeliveryForTest(context.Background(), delivery)

	if delivery.acked || !delivery.nacked || !delivery.nackRequeue {
		t.Fatalf("expected OCR overload to nack requeue, got ack=%v nack=%v requeue=%v", delivery.acked, delivery.nacked, delivery.nackRequeue)
	}
	if got := retryStore.Count(task.Key); got != 1 {
		t.Fatalf("expected retry counter to increment once, got %d", got)
	}
	tasks, causes := terminal.Calls()
	if len(tasks) != 0 || len(causes) != 0 {
		t.Fatalf("expected no terminal call while OCR overload is retryable, got tasks=%d causes=%d", len(tasks), len(causes))
	}
}

func TestRabbitMQSchedulerHandleDeliveryFailureModesRequeue(t *testing.T) {
	t.Parallel()

	testCases := map[string]struct {
		runner  documentsync.Runner
		timeout time.Duration
	}{
		"ordinary_error": {
			runner:  &rabbitRecordingRunner{err: errRabbitRunnerFailed},
			timeout: 200 * time.Millisecond,
		},
		"panic": {
			runner:  rabbitPanicRunner{},
			timeout: 200 * time.Millisecond,
		},
		"hard_timeout": {
			runner:  rabbitTimeoutRunner{},
			timeout: 10 * time.Millisecond,
		},
	}

	for name, tc := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			terminal := &rabbitTerminalHandler{}
			scheduler := newRabbitMQSchedulerForTestWithOptions(
				t,
				tc.runner,
				&rabbitFakeBroker{enabled: true},
				terminal,
				rabbitSchedulerTestOptions{timeout: tc.timeout},
			)
			delivery := newRabbitTaskDelivery(t, newRabbitMQDocumentSyncTask(t))

			scheduler.HandleDeliveryForTest(context.Background(), delivery)

			if delivery.acked || !delivery.nacked || !delivery.nackRequeue {
				t.Fatalf("expected nack requeue without ack, got ack=%v nack=%v requeue=%v", delivery.acked, delivery.nacked, delivery.nackRequeue)
			}
			tasks, causes := terminal.Calls()
			if len(tasks) != 0 || len(causes) != 0 {
				t.Fatalf("expected no terminal call, got tasks=%d causes=%d", len(tasks), len(causes))
			}
		})
	}
}

func TestRabbitMQSchedulerHandleDeliveryRetryStoreErrorRequeues(t *testing.T) {
	t.Parallel()

	retryStore := newRabbitMemoryRetryStore()
	retryStore.err = errRabbitRetryStoreUnavailable
	terminal := &rabbitTerminalHandler{}
	scheduler := newRabbitMQSchedulerForTestWithOptions(
		t,
		&rabbitRecordingRunner{err: errRabbitRunnerFailed},
		&rabbitFakeBroker{enabled: true},
		terminal,
		rabbitSchedulerTestOptions{retryStore: retryStore},
	)
	delivery := newRabbitTaskDelivery(t, newRabbitMQDocumentSyncTask(t))

	scheduler.HandleDeliveryForTest(context.Background(), delivery)

	if delivery.acked || !delivery.nacked || !delivery.nackRequeue {
		t.Fatalf("expected retry store failure to nack requeue, got ack=%v nack=%v requeue=%v", delivery.acked, delivery.nacked, delivery.nackRequeue)
	}
	tasks, causes := terminal.Calls()
	if len(tasks) != 0 || len(causes) != 0 {
		t.Fatalf("expected no terminal call on retry store failure, got tasks=%d causes=%d", len(tasks), len(causes))
	}
}

func TestRabbitMQSchedulerStartDoesNotPublishRecoveryMessages(t *testing.T) {
	t.Parallel()

	consumerCreated := make(chan struct{})
	consumer := &rabbitFakeConsumer{deliveries: make(chan documentsync.RabbitMQDelivery)}
	broker := &rabbitFakeBroker{
		enabled: true,
		newConsumer: func(context.Context, string, int, string) (documentsync.RabbitMQConsumer, error) {
			select {
			case <-consumerCreated:
			default:
				close(consumerCreated)
			}
			return consumer, nil
		},
	}
	scheduler := newRabbitMQSchedulerForTest(t, &rabbitRecordingRunner{}, broker, nil)

	runCtx, cancelRun := context.WithCancel(context.Background())
	startDone := make(chan error, 1)
	go func() {
		startDone <- scheduler.Start(runCtx)
	}()

	waitForRabbitSignal(t, consumerCreated)
	if got := broker.PublishedMessages(); len(got) != 0 {
		t.Fatalf("expected startup to publish no recovery messages, got %#v", got)
	}

	cancelRun()
	select {
	case err := <-startDone:
		if err != nil {
			t.Fatalf("scheduler start returned error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for scheduler start to exit")
	}
}

func TestRabbitMQSchedulerStartClampsConsumerPrefetchToOne(t *testing.T) {
	t.Parallel()

	consumerCreated := make(chan struct{})
	consumer := &rabbitFakeConsumer{deliveries: make(chan documentsync.RabbitMQDelivery)}
	broker := &rabbitFakeBroker{
		enabled: true,
		newConsumer: func(context.Context, string, int, string) (documentsync.RabbitMQConsumer, error) {
			select {
			case <-consumerCreated:
			default:
				close(consumerCreated)
			}
			return consumer, nil
		},
	}
	scheduler := newRabbitMQSchedulerForTestWithConfig(
		t,
		&rabbitRecordingRunner{},
		broker,
		nil,
		func(cfg *documentsync.RabbitMQSchedulerConfig) {
			cfg.ConsumerPrefetch = 16
		},
	)

	runCtx, cancelRun := context.WithCancel(context.Background())
	startDone := make(chan error, 1)
	go func() {
		startDone <- scheduler.Start(runCtx)
	}()

	waitForRabbitSignal(t, consumerCreated)
	calls := broker.ConsumerCalls()
	if len(calls) == 0 {
		t.Fatal("expected consumer creation to be recorded")
	}
	if calls[0].Prefetch != 1 {
		t.Fatalf("expected effective prefetch 1, got %d", calls[0].Prefetch)
	}

	cancelRun()
	select {
	case err := <-startDone:
		if err != nil {
			t.Fatalf("scheduler start returned error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for scheduler start to exit")
	}
}

func TestRabbitMQSchedulerStartWaitsReadinessBeforeConsume(t *testing.T) {
	t.Parallel()

	consumerCreated := make(chan struct{})
	consumer := &rabbitFakeConsumer{deliveries: make(chan documentsync.RabbitMQDelivery)}
	broker := &rabbitFakeBroker{
		enabled: true,
		newConsumer: func(context.Context, string, int, string) (documentsync.RabbitMQConsumer, error) {
			close(consumerCreated)
			return consumer, nil
		},
	}
	scheduler := newRabbitMQSchedulerForTest(t, &rabbitRecordingRunner{}, broker, nil)

	ready := make(chan struct{})
	gate := &rabbitBlockingReadinessGate{
		ready:       ready,
		waitStarted: make(chan struct{}),
	}
	scheduler.SetReadinessGateForTest(gate)

	runCtx, cancelRun := context.WithCancel(context.Background())
	startDone := make(chan error, 1)
	go func() {
		startDone <- scheduler.Start(runCtx)
	}()
	defer func() {
		cancelRun()
		select {
		case <-startDone:
		case <-time.After(3 * time.Second):
			t.Fatal("timed out waiting for scheduler start to exit")
		}
	}()

	waitForRabbitSignal(t, gate.waitStarted)
	select {
	case <-consumerCreated:
		t.Fatal("consumer should not start before readiness")
	case <-time.After(50 * time.Millisecond):
	}

	close(ready)
	waitForRabbitSignal(t, consumerCreated)
}

func newRabbitMQSchedulerForTest(
	t *testing.T,
	runner documentsync.Runner,
	broker *rabbitFakeBroker,
	terminal documentsync.TerminalHandler,
) *documentsync.RabbitMQScheduler {
	t.Helper()
	return newRabbitMQSchedulerForTestWithConfig(t, runner, broker, terminal, nil)
}

func newRabbitMQSchedulerForTestWithConfig(
	t *testing.T,
	runner documentsync.Runner,
	broker *rabbitFakeBroker,
	terminal documentsync.TerminalHandler,
	mutateConfig func(*documentsync.RabbitMQSchedulerConfig),
) *documentsync.RabbitMQScheduler {
	t.Helper()
	return newRabbitMQSchedulerForTestWithOptions(t, runner, broker, terminal, rabbitSchedulerTestOptions{mutateConfig: mutateConfig})
}

type rabbitSchedulerTestOptions struct {
	retryStore        documentsync.RetryStore
	admissionGate     documentsync.MemoryAdmissionGate
	nonRetryableError func(error) bool
	mutateConfig      func(*documentsync.RabbitMQSchedulerConfig)
	timeout           time.Duration
}

func newRabbitMQSchedulerForTestWithOptions(
	t *testing.T,
	runner documentsync.Runner,
	broker *rabbitFakeBroker,
	terminal documentsync.TerminalHandler,
	options rabbitSchedulerTestOptions,
) *documentsync.RabbitMQScheduler {
	t.Helper()
	if broker == nil {
		broker = &rabbitFakeBroker{enabled: true}
	}
	if options.retryStore == nil {
		options.retryStore = newRabbitMemoryRetryStore()
	}
	if options.timeout <= 0 {
		options.timeout = 200 * time.Millisecond
	}
	cfg := documentsync.DefaultRabbitMQSchedulerConfig()
	cfg.QueueName = "knowledge.document.sync.test"
	cfg.MQPublishTimeout = 200 * time.Millisecond
	cfg.ConsumerConcurrency = 1
	if options.mutateConfig != nil {
		options.mutateConfig(&cfg)
	}
	return documentsync.NewRabbitMQScheduler(
		runner,
		documentsync.RabbitMQSchedulerDeps{
			Logger:            logging.New().Named("documentsync.rabbitmq.test"),
			Broker:            broker,
			TerminalHandler:   terminal,
			RetryStore:        options.retryStore,
			AdmissionGate:     options.admissionGate,
			NonRetryableError: options.nonRetryableError,
		},
		cfg,
		options.timeout,
	)
}

func newRabbitMQDocumentSyncTask(t *testing.T) *documentsync.Task {
	t.Helper()
	payload := mustJSON(t, map[string]any{
		"organization_code":   "ORG-1",
		"knowledge_base_code": rabbitTestKnowledgeBaseCode,
		"code":                rabbitTestDocumentCode,
		"mode":                documentsync.ResyncModeForTest,
		"async":               true,
	})
	return &documentsync.Task{
		Kind:              documentsync.TaskKindDocumentSync,
		KnowledgeBaseCode: rabbitTestKnowledgeBaseCode,
		Code:              rabbitTestDocumentCode,
		Mode:              documentsync.ResyncModeForTest,
		Async:             true,
		Payload:           payload,
	}
}

func newRabbitTaskDelivery(t *testing.T, task *documentsync.Task) *rabbitFakeDelivery {
	t.Helper()
	async := task.Async
	payload := json.RawMessage(task.Payload)
	body := mustJSON(t, documentsync.RabbitMQTaskMessage{
		Kind:              task.Kind,
		KnowledgeBaseCode: task.KnowledgeBaseCode,
		DocumentCode:      task.Code,
		Mode:              task.Mode,
		Async:             &async,
		Payload:           &payload,
		RequestID:         task.RequestID,
		Key:               task.Key,
	})
	return &rabbitFakeDelivery{body: body}
}

func mustJSON(t *testing.T, value any) []byte {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}
	return body
}

func waitForRabbitSignal(t *testing.T, ch <-chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for signal")
	}
}
