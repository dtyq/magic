package documentsync

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/runguard"
)

const (
	defaultRabbitMQConsumerReconnectDelay = time.Second
	rabbitMQSerialConsumerPrefetch        = 1
	defaultRabbitMQPrefetch               = 1
	defaultMQPublishTimeout               = 5 * time.Second
	defaultRabbitMQMaxRequeueAttempts     = 20
)

var (
	errRabbitMQSchedulerAlreadyRun = errors.New("rabbitmq scheduler already running")
	errRabbitMQTaskPanic           = errors.New("rabbitmq document sync task panic")
	errRabbitMQConsumerPanic       = errors.New("rabbitmq document sync consumer panic")
	errRabbitMQTaskHardTimeout     = errors.New("rabbitmq document sync task hard timeout")
)

type rabbitMQTaskBroker interface {
	Enabled() bool
	PublishTask(ctx context.Context, queue string, message RabbitMQTaskMessage) error
	NewConsumer(ctx context.Context, queue string, prefetch int, consumerTag string) (RabbitMQConsumer, error)
}

// RabbitMQSchedulerConfig 定义 MQ 文档调度参数。
type RabbitMQSchedulerConfig struct {
	QueueName           string
	ConsumerPrefetch    int
	ConsumerConcurrency int
	MQPublishTimeout    time.Duration
	MaxRequeueAttempts  int
}

// RabbitMQSchedulerDeps 聚合 RabbitMQ 调度器依赖。
type RabbitMQSchedulerDeps struct {
	Logger            *logging.SugaredLogger
	Broker            rabbitMQTaskBroker
	TerminalHandler   TerminalHandler
	ReadinessGate     ReadinessGate
	RetryStore        RetryStore
	AdmissionGate     MemoryAdmissionGate
	NonRetryableError func(error) bool
}

// DefaultRabbitMQSchedulerConfig 返回默认 MQ 调度配置。
func DefaultRabbitMQSchedulerConfig() RabbitMQSchedulerConfig {
	return RabbitMQSchedulerConfig{
		ConsumerPrefetch:    defaultRabbitMQPrefetch,
		ConsumerConcurrency: 1,
		MQPublishTimeout:    defaultMQPublishTimeout,
		MaxRequeueAttempts:  defaultRabbitMQMaxRequeueAttempts,
	}
}

// RabbitMQScheduler 提供基于 RabbitMQ task 消息的文档同步调度。
type RabbitMQScheduler struct {
	runner          Runner
	logger          *logging.SugaredLogger
	broker          rabbitMQTaskBroker
	config          RabbitMQSchedulerConfig
	timeout         time.Duration
	terminalHandler TerminalHandler
	readinessGate   ReadinessGate
	retryStore      RetryStore
	admissionGate   MemoryAdmissionGate
	nonRetryableErr func(error) bool

	lifecycleMu sync.Mutex
	runDone     chan struct{}
}

// NewRabbitMQScheduler 创建 MQ 调度器。
func NewRabbitMQScheduler(
	runner Runner,
	deps RabbitMQSchedulerDeps,
	config RabbitMQSchedulerConfig,
	timeout time.Duration,
) *RabbitMQScheduler {
	if timeout <= 0 {
		timeout = defaultTaskTimeout
	}
	config = normalizeRabbitMQSchedulerConfig(config)

	return &RabbitMQScheduler{
		runner:          runner,
		logger:          deps.Logger,
		broker:          deps.Broker,
		config:          config,
		timeout:         timeout,
		terminalHandler: deps.TerminalHandler,
		readinessGate:   deps.ReadinessGate,
		retryStore:      deps.RetryStore,
		admissionGate:   deps.AdmissionGate,
		nonRetryableErr: deps.NonRetryableError,
	}
}

func normalizeRabbitMQSchedulerConfig(config RabbitMQSchedulerConfig) RabbitMQSchedulerConfig {
	defaults := DefaultRabbitMQSchedulerConfig()
	if config.ConsumerPrefetch <= 0 {
		config.ConsumerPrefetch = defaults.ConsumerPrefetch
	}
	if config.ConsumerConcurrency <= 0 {
		config.ConsumerConcurrency = defaults.ConsumerConcurrency
	}
	if config.MQPublishTimeout <= 0 {
		config.MQPublishTimeout = defaults.MQPublishTimeout
	}
	if config.MaxRequeueAttempts <= 0 {
		config.MaxRequeueAttempts = defaults.MaxRequeueAttempts
	}
	return config
}

func (s *RabbitMQScheduler) logConsumerPrefetchClamp(ctx context.Context) {
	if s == nil || s.logger == nil || s.config.ConsumerPrefetch <= 1 {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Clamp rabbitmq document sync consumer prefetch to 1 for serial delivery handling",
		"queue", s.config.QueueName,
		"configured_prefetch", s.config.ConsumerPrefetch,
		"effective_prefetch", rabbitMQSerialConsumerPrefetch,
	)
}

// Schedule 调度文档同步任务。
func (s *RabbitMQScheduler) Schedule(ctx context.Context, task *Task) {
	if s == nil || s.runner == nil || task == nil {
		return
	}

	cloned := captureTaskRequestID(ctx, CloneTask(task))
	if !s.shouldPublishTask(cloned) {
		s.logSkippedTask(ctx, cloned, "unsupported_task_for_rabbitmq")
		return
	}
	ensureRabbitMQTaskKey(cloned)

	message, ok := newRabbitMQTaskMessage(cloned)
	if !ok || !isValidRabbitMQTaskMessage(message) {
		s.logSkippedTask(ctx, cloned, "invalid_task_for_publish")
		return
	}

	publishCtx, cancel := context.WithTimeout(detachTaskContext(ctx, cloned), s.config.MQPublishTimeout)
	defer cancel()
	if err := s.broker.PublishTask(publishCtx, s.config.QueueName, message); err != nil {
		s.logScheduleError(publishCtx, cloned, "Publish rabbitmq document sync task failed", err)
	}
}

func (s *RabbitMQScheduler) shouldPublishTask(task *Task) bool {
	if task == nil || !task.Async || strings.TrimSpace(task.Kind) != TaskKindDocumentSync {
		return false
	}
	return s.enabled()
}

// Start 启动 MQ 消费循环。
func (s *RabbitMQScheduler) Start(ctx context.Context) error {
	if !s.enabled() {
		return nil
	}
	done, err := s.beginRun()
	if err != nil {
		return err
	}
	defer s.finishRun(done)
	s.logConsumerPrefetchClamp(ctx)
	if err := s.waitReadinessGate(ctx); err != nil {
		return err
	}

	workerCount := s.config.ConsumerConcurrency
	resultCh := make(chan error, workerCount)
	for workerIndex := range workerCount {
		go func(index int) {
			defer runguard.Recover(ctx, runguard.Options{
				Scope:  "rabbitmq.document_sync.consumer",
				Policy: runguard.Continue,
				Fields: []any{
					"queue", strings.TrimSpace(s.config.QueueName),
					"consumer_index", index,
				},
				OnPanic: func(ctx context.Context, report runguard.Report) {
					if s.logger != nil {
						s.logger.KnowledgeErrorContext(ctx, "Rabbitmq document sync consumer panic recovered", report.Fields...)
					}
					resultCh <- fmt.Errorf("%w: %v", errRabbitMQConsumerPanic, report.Recovered)
				},
			})
			resultCh <- s.consumeLoop(ctx, index)
		}(workerIndex)
	}

	var firstErr error
	for range workerCount {
		err := <-resultCh
		if err != nil && !errors.Is(err, context.Canceled) && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

type namedReadinessGate interface {
	Name() string
}

func (s *RabbitMQScheduler) waitReadinessGate(ctx context.Context) error {
	if s == nil || s.readinessGate == nil {
		return nil
	}
	gateName := readinessGateName(s.readinessGate)
	if err := s.readinessGate.WaitReady(ctx); err != nil {
		return fmt.Errorf("wait rabbitmq document sync readiness gate %q: %w", gateName, err)
	}
	return nil
}

func readinessGateName(gate ReadinessGate) string {
	if named, ok := gate.(namedReadinessGate); ok {
		name := strings.TrimSpace(named.Name())
		if name != "" {
			return name
		}
	}
	return "readiness-gate"
}

// Stop 等待消费 worker 基于外层 context 退出。
func (s *RabbitMQScheduler) Stop(ctx context.Context) error {
	if s == nil {
		return nil
	}

	done := s.currentRunDone()
	if done == nil {
		return nil
	}

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("wait rabbitmq scheduler stop: %w", ctx.Err())
	}
}

// Close 保持调度器生命周期接口兼容。
func (s *RabbitMQScheduler) Close() error {
	return nil
}

func (s *RabbitMQScheduler) beginRun() (chan struct{}, error) {
	s.lifecycleMu.Lock()
	defer s.lifecycleMu.Unlock()

	if s.runDone != nil {
		return nil, errRabbitMQSchedulerAlreadyRun
	}
	done := make(chan struct{})
	s.runDone = done
	return done, nil
}

func (s *RabbitMQScheduler) finishRun(done chan struct{}) {
	s.lifecycleMu.Lock()
	defer s.lifecycleMu.Unlock()

	if s.runDone == done {
		close(done)
		s.runDone = nil
	}
}

func (s *RabbitMQScheduler) currentRunDone() chan struct{} {
	s.lifecycleMu.Lock()
	defer s.lifecycleMu.Unlock()

	return s.runDone
}

func (s *RabbitMQScheduler) enabled() bool {
	if s == nil || s.runner == nil {
		return false
	}
	if s.broker == nil || !s.broker.Enabled() {
		return false
	}
	return strings.TrimSpace(s.config.QueueName) != ""
}

func (s *RabbitMQScheduler) consumeLoop(ctx context.Context, workerIndex int) error {
	consumerTag := fmt.Sprintf("knowledge-document-sync-%d", workerIndex)
	for {
		if err := ctx.Err(); err != nil {
			return wrapContextError("rabbitmq consume loop context done", err)
		}

		consumer, err := s.broker.NewConsumer(ctx, s.config.QueueName, rabbitMQSerialConsumerPrefetch, consumerTag)
		if err != nil {
			if s.logger != nil {
				s.logger.KnowledgeWarnContext(ctx, "Create rabbitmq consumer failed", "queue", s.config.QueueName, "consumer_tag", consumerTag, "error", err)
			}
			if err := s.waitReconnect(ctx); err != nil {
				return err
			}
			continue
		}
		consumeErr := s.handleDeliveries(ctx, consumer)
		if consumeErr == nil {
			s.logConsumerDeliveriesClosed(ctx, consumerTag)
		}
		if closeErr := consumer.Close(); closeErr != nil && s.logger != nil && !errors.Is(closeErr, context.Canceled) {
			s.logger.KnowledgeWarnContext(ctx, "Close rabbitmq consumer failed", "queue", s.config.QueueName, "consumer_tag", consumerTag, "error", closeErr)
		}
		if consumeErr != nil && !errors.Is(consumeErr, context.Canceled) && s.logger != nil {
			s.logger.KnowledgeWarnContext(ctx, "Rabbitmq consume loop stopped, reconnecting", "queue", s.config.QueueName, "consumer_tag", consumerTag, "error", consumeErr)
		}
		s.logConsumerReconnecting(ctx, consumerTag, consumeErr)
		if err := s.waitReconnect(ctx); err != nil {
			return err
		}
	}
}

func (s *RabbitMQScheduler) logConsumerDeliveriesClosed(ctx context.Context, consumerTag string) {
	if s == nil || s.logger == nil || ctx.Err() != nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		rabbitMQDocumentResyncLogKey+" consumer deliveries closed",
		"queue", strings.TrimSpace(s.config.QueueName),
		"consumer_tag", strings.TrimSpace(consumerTag),
	)
}

func (s *RabbitMQScheduler) logConsumerReconnecting(ctx context.Context, consumerTag string, err error) {
	if s == nil || s.logger == nil || ctx.Err() != nil {
		return
	}
	fields := []any{
		"queue", strings.TrimSpace(s.config.QueueName),
		"consumer_tag", strings.TrimSpace(consumerTag),
	}
	if err != nil {
		fields = append(fields, "error", err)
	}
	s.logger.KnowledgeWarnContext(ctx, rabbitMQDocumentResyncLogKey+" consumer reconnecting", fields...)
}

func (s *RabbitMQScheduler) handleDeliveries(ctx context.Context, consumer RabbitMQConsumer) error {
	for {
		select {
		case <-ctx.Done():
			return wrapContextError("rabbitmq delivery handler context done", ctx.Err())
		case delivery, ok := <-consumer.Deliveries():
			if !ok {
				return nil
			}
			s.handleDelivery(ctx, delivery)
		}
	}
}

func (s *RabbitMQScheduler) handleDelivery(ctx context.Context, delivery RabbitMQDelivery) {
	body := delivery.Body()
	s.logConsumedTask(ctx, body)
	task, skipReason := decodeRabbitMQTaskDelivery(body)
	if skipReason != "" {
		s.logSkippedDelivery(ctx, skipReason, body)
		_ = delivery.Ack(false)
		return
	}
	ensureRabbitMQTaskRetryKey(s.config.QueueName, task)

	handleCtx := withTaskContext(ctx, task)
	if s.logger != nil {
		s.logger.InfoContext(
			handleCtx,
			"knowledge_async_message received rabbitmq document sync task",
			"knowledge_base_code", task.KnowledgeBaseCode,
			"document_code", task.Code,
			"task_kind", task.Kind,
			"mode", task.Mode,
		)
	}

	if err := s.waitTaskAdmission(handleCtx, delivery, task); err != nil {
		return
	}
	if err := s.runTask(handleCtx, task); err != nil {
		s.handleTaskFailure(handleCtx, delivery, task, err)
		return
	}
	s.resetTaskRetry(handleCtx, task)
	if err := delivery.Ack(false); err != nil {
		s.logDeliveryAckError(handleCtx, task, err)
	}
}

func (s *RabbitMQScheduler) waitTaskAdmission(
	ctx context.Context,
	delivery RabbitMQDelivery,
	task *Task,
) error {
	if s == nil || s.admissionGate == nil {
		return nil
	}
	if err := s.admissionGate.Wait(ctx, task); err != nil {
		if nackErr := delivery.Nack(false, true); nackErr != nil {
			s.logDeliveryNackError(ctx, task, nackErr)
		}
		return fmt.Errorf("wait rabbitmq document sync task admission: %w", err)
	}
	return nil
}

func decodeRabbitMQTaskDelivery(body []byte) (*Task, string) {
	if len(bytes.TrimSpace(body)) == 0 {
		return nil, "empty_body"
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, "malformed_json"
	}

	var message RabbitMQTaskMessage
	if err := json.Unmarshal(body, &message); err != nil {
		return nil, "malformed_task_message"
	}
	if message.Kind == "" {
		if hasLegacyRabbitMQWakeupShape(raw) {
			return nil, "legacy_wakeup_message"
		}
		return nil, "missing_kind"
	}
	if strings.TrimSpace(message.Kind) != TaskKindDocumentSync {
		return nil, "unknown_task_kind"
	}
	if !isValidRabbitMQTaskMessage(message) {
		return nil, "invalid_task_message"
	}

	task := &Task{
		Kind:              strings.TrimSpace(message.Kind),
		KnowledgeBaseCode: strings.TrimSpace(message.KnowledgeBaseCode),
		Code:              strings.TrimSpace(message.DocumentCode),
		Mode:              strings.TrimSpace(message.Mode),
		Async:             *message.Async,
		Key:               strings.TrimSpace(message.Key),
		Payload:           append([]byte(nil), (*message.Payload)...),
		RequestID:         strings.TrimSpace(message.RequestID),
	}
	return task, ""
}

func hasLegacyRabbitMQWakeupShape(raw map[string]json.RawMessage) bool {
	_, hasDedupeKey := raw["dedupe_key"]
	_, hasWakeupID := raw["wakeup_id"]
	_, hasTaskKind := raw["task_kind"]
	return hasDedupeKey || hasWakeupID || hasTaskKind
}

func isValidRabbitMQTaskMessage(message RabbitMQTaskMessage) bool {
	if strings.TrimSpace(message.Kind) != TaskKindDocumentSync {
		return false
	}
	if strings.TrimSpace(message.KnowledgeBaseCode) == "" ||
		strings.TrimSpace(message.DocumentCode) == "" ||
		strings.TrimSpace(message.Mode) == "" ||
		message.Async == nil ||
		message.Payload == nil {
		return false
	}
	payload := bytes.TrimSpace(*message.Payload)
	if len(payload) == 0 || bytes.Equal(payload, []byte("null")) || payload[0] != '{' {
		return false
	}
	return json.Valid(payload)
}

func (s *RabbitMQScheduler) logConsumedTask(ctx context.Context, body []byte) {
	if s == nil || s.logger == nil {
		return
	}
	s.logger.InfoContext(
		ctx,
		rabbitMQDocumentResyncLogKey+" consume message",
		"queue", strings.TrimSpace(s.config.QueueName),
		rabbitMQMessageContentLogFieldKey, string(body),
	)
}

func (s *RabbitMQScheduler) logSkippedDelivery(ctx context.Context, reason string, body []byte) {
	if s == nil || s.logger == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Skip rabbitmq document sync message",
		"queue", strings.TrimSpace(s.config.QueueName),
		"skip_reason", reason,
		rabbitMQMessageContentLogFieldKey, string(body),
	)
}

func (s *RabbitMQScheduler) logSkippedTask(ctx context.Context, task *Task, reason string) {
	if s == nil || s.logger == nil || task == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Skip publishing rabbitmq document sync task",
		"task_kind", task.Kind,
		"document_code", task.Code,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"mode", task.Mode,
		"skip_reason", reason,
	)
}

func (s *RabbitMQScheduler) runTask(ctx context.Context, task *Task) error {
	runCtx, cancel := context.WithTimeout(withTaskContext(ctx, task), s.timeout)
	defer cancel()

	result := make(chan error, 1)
	go func() {
		result <- runRabbitMQTaskWithRecover(runCtx, s.logger, s.runner, task)
	}()

	var err error
	select {
	case err = <-result:
	case <-runCtx.Done():
		err = runCtx.Err()
		if errors.Is(err, context.DeadlineExceeded) {
			err = fmt.Errorf("%w after %s: %w", errRabbitMQTaskHardTimeout, s.timeout, err)
			if s.logger != nil {
				s.logger.KnowledgeErrorContext(
					ctx,
					"Rabbitmq document sync task hard timeout",
					"task_kind", task.Kind,
					"document_code", task.Code,
					"knowledge_base_code", task.KnowledgeBaseCode,
					"mode", task.Mode,
					"timeout", s.timeout.String(),
				)
			}
		}
	}

	if err != nil && s.logger != nil {
		s.logger.KnowledgeErrorContext(
			runCtx,
			"Document sync execution failed",
			"task_kind", task.Kind,
			"document_code", task.Code,
			"knowledge_base_code", task.KnowledgeBaseCode,
			"mode", task.Mode,
			"error", err,
		)
	}
	return err
}

func runRabbitMQTaskWithRecover(ctx context.Context, logger *logging.SugaredLogger, runner Runner, task *Task) (err error) {
	if runner == nil {
		return nil
	}
	defer runguard.Recover(ctx, runguard.Options{
		Scope:  "rabbitmq.document_sync.task",
		Policy: runguard.Continue,
		Fields: rabbitMQTaskPanicFields(task),
		OnPanic: func(ctx context.Context, report runguard.Report) {
			if logger != nil {
				logger.KnowledgeErrorContext(ctx, "Rabbitmq document sync task panic recovered", report.Fields...)
			}
			err = fmt.Errorf("%w: %v", errRabbitMQTaskPanic, report.Recovered)
		},
	})
	if err := runner.Run(ctx, task); err != nil {
		return fmt.Errorf("run rabbitmq document sync task: %w", err)
	}
	return nil
}

func rabbitMQTaskPanicFields(task *Task) []any {
	fields := make([]any, 0, 10)
	if task == nil {
		return fields
	}
	return append(fields,
		"task_kind", task.Kind,
		"document_code", task.Code,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"mode", task.Mode,
	)
}

func (s *RabbitMQScheduler) handleTaskFailure(ctx context.Context, delivery RabbitMQDelivery, task *Task, cause error) {
	if s.shouldRequeueFailedTask(ctx, task, cause) {
		if err := delivery.Nack(false, true); err != nil {
			s.logDeliveryNackError(ctx, task, err)
		}
		return
	}
	s.handleTerminalTaskFailure(ctx, task, cause)
	s.resetTaskRetry(ctx, task)
	if err := delivery.Ack(false); err != nil {
		s.logDeliveryAckError(ctx, task, err)
	}
}

func (s *RabbitMQScheduler) shouldRequeueFailedTask(ctx context.Context, task *Task, cause error) bool {
	if task == nil {
		return false
	}
	if s != nil && s.nonRetryableErr != nil && s.nonRetryableErr(cause) {
		s.logTaskNonRetryable(ctx, task, cause)
		return false
	}
	if s == nil || s.retryStore == nil {
		s.logRetryStoreError(ctx, task, cause, "missing rabbitmq document sync retry store", nil)
		return true
	}

	retryCount, err := s.retryStore.Increment(ctx, task.Key)
	if err != nil {
		s.logRetryStoreError(ctx, task, cause, "Increment rabbitmq document sync retry counter failed", err)
		return true
	}
	if retryCount <= s.config.MaxRequeueAttempts {
		s.logTaskRequeue(ctx, task, cause, retryCount)
		return true
	}
	s.logTaskRetryExhausted(ctx, task, cause, retryCount)
	return false
}

func (s *RabbitMQScheduler) logTaskNonRetryable(ctx context.Context, task *Task, cause error) {
	if s == nil || s.logger == nil || task == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Rabbitmq document sync task failed with non-retryable error",
		"task_kind", task.Kind,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"document_code", task.Code,
		"mode", task.Mode,
		"task_key", task.Key,
		"error", cause,
	)
}

func (s *RabbitMQScheduler) resetTaskRetry(ctx context.Context, task *Task) {
	if s == nil || s.retryStore == nil || task == nil || strings.TrimSpace(task.Key) == "" {
		return
	}
	if err := s.retryStore.Reset(ctx, task.Key); err != nil && s.logger != nil {
		s.logger.KnowledgeWarnContext(
			ctx,
			"Reset rabbitmq document sync retry counter failed",
			"task_kind", task.Kind,
			"knowledge_base_code", task.KnowledgeBaseCode,
			"document_code", task.Code,
			"mode", task.Mode,
			"task_key", task.Key,
			"error", err,
		)
	}
}

func (s *RabbitMQScheduler) handleTerminalTaskFailure(ctx context.Context, task *Task, cause error) {
	if s == nil || s.terminalHandler == nil || task == nil || strings.TrimSpace(task.Kind) != TaskKindDocumentSync {
		return
	}
	if err := s.terminalHandler.HandleTerminalTask(ctx, task, cause); err != nil && s.logger != nil {
		if errors.Is(err, ErrTerminalHandlerNotRegistered) {
			return
		}
		s.logger.KnowledgeWarnContext(
			ctx,
			"Handle failed rabbitmq document sync terminal task failed",
			"task_kind", task.Kind,
			"knowledge_base_code", task.KnowledgeBaseCode,
			"document_code", task.Code,
			"error", err,
		)
	}
}

func (s *RabbitMQScheduler) logTaskRequeue(ctx context.Context, task *Task, cause error, retryCount int) {
	if s == nil || s.logger == nil || task == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Requeue rabbitmq document sync task after failure",
		"task_kind", task.Kind,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"document_code", task.Code,
		"mode", task.Mode,
		"task_key", task.Key,
		"retry_count", retryCount,
		"max_requeue_attempts", s.config.MaxRequeueAttempts,
		"error", cause,
	)
}

func (s *RabbitMQScheduler) logTaskRetryExhausted(ctx context.Context, task *Task, cause error, retryCount int) {
	if s == nil || s.logger == nil || task == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Rabbitmq document sync task retry exhausted",
		"task_kind", task.Kind,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"document_code", task.Code,
		"mode", task.Mode,
		"task_key", task.Key,
		"retry_count", retryCount,
		"max_requeue_attempts", s.config.MaxRequeueAttempts,
		"error", cause,
	)
}

func (s *RabbitMQScheduler) logRetryStoreError(ctx context.Context, task *Task, cause error, message string, err error) {
	if s == nil || s.logger == nil || task == nil {
		return
	}
	fields := []any{
		"task_kind", task.Kind,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"document_code", task.Code,
		"mode", task.Mode,
		"task_key", task.Key,
		"task_error", cause,
	}
	if err != nil {
		fields = append(fields, "error", err)
	}
	s.logger.KnowledgeErrorContext(ctx, message, fields...)
}

func (s *RabbitMQScheduler) logDeliveryAckError(ctx context.Context, task *Task, err error) {
	if s == nil || s.logger == nil || task == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Ack rabbitmq document sync delivery failed",
		"task_kind", task.Kind,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"document_code", task.Code,
		"mode", task.Mode,
		"task_key", task.Key,
		"error", err,
	)
}

func (s *RabbitMQScheduler) logDeliveryNackError(ctx context.Context, task *Task, err error) {
	if s == nil || s.logger == nil || task == nil {
		return
	}
	s.logger.KnowledgeWarnContext(
		ctx,
		"Nack rabbitmq document sync delivery failed",
		"task_kind", task.Kind,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"document_code", task.Code,
		"mode", task.Mode,
		"task_key", task.Key,
		"error", err,
	)
}

func ensureRabbitMQTaskKey(task *Task) {
	if task == nil {
		return
	}
	if strings.TrimSpace(task.Key) != "" {
		task.Key = strings.TrimSpace(task.Key)
		return
	}
	task.Key = uuid.NewString()
}

func ensureRabbitMQTaskRetryKey(queue string, task *Task) {
	if task == nil {
		return
	}
	if strings.TrimSpace(task.Key) != "" {
		task.Key = strings.TrimSpace(task.Key)
		return
	}
	task.Key = fallbackRabbitMQTaskRetryKey(queue, task)
}

func fallbackRabbitMQTaskRetryKey(queue string, task *Task) string {
	if task == nil {
		return ""
	}
	payload := bytes.TrimSpace(task.Payload)
	hash := sha256.Sum256([]byte(strings.Join([]string{
		strings.TrimSpace(queue),
		strings.TrimSpace(task.Kind),
		strings.TrimSpace(task.KnowledgeBaseCode),
		strings.TrimSpace(task.Code),
		strings.TrimSpace(task.Mode),
		string(payload),
	}, "\x00")))
	return "fallback:" + hex.EncodeToString(hash[:])
}

func (s *RabbitMQScheduler) waitReconnect(ctx context.Context) error {
	timer := time.NewTimer(defaultRabbitMQConsumerReconnectDelay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return wrapContextError("rabbitmq reconnect wait context done", ctx.Err())
	case <-timer.C:
		return nil
	}
}

func (s *RabbitMQScheduler) logScheduleError(ctx context.Context, task *Task, message string, err error) {
	if s.logger == nil || task == nil {
		return
	}
	s.logger.KnowledgeErrorContext(
		ctx,
		message,
		"task_kind", task.Kind,
		"document_code", task.Code,
		"knowledge_base_code", task.KnowledgeBaseCode,
		"mode", task.Mode,
		"error", err,
	)
}

func wrapContextError(message string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", message, err)
}
