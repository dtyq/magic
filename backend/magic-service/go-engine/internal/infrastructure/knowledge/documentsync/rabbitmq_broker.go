package documentsync

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/runguard"
)

const (
	rabbitMQDeclareTimeout            = 5 * time.Second
	rabbitMQDocumentResyncLogKey      = "goEngine knowledge.document.resync"
	rabbitMQMessageContentLogFieldKey = "message_content"
)

var (
	errRabbitMQQueueNameRequired = errors.New("rabbitmq queue name is required")
	errRabbitMQNilChannelOpener  = errors.New("rabbitmq connection channel opener is nil")
	errRabbitMQNilQueueDeclarer  = errors.New("rabbitmq channel queue declarer is nil")
	errRabbitMQNilPublisher      = errors.New("rabbitmq channel publisher is nil")
	errRabbitMQNilConfirmEnabler = errors.New("rabbitmq channel confirm enabler is nil")
	errRabbitMQNilQosSetter      = errors.New("rabbitmq channel qos setter is nil")
	errRabbitMQNilConsumer       = errors.New("rabbitmq channel consumer is nil")
	errRabbitMQHostRequired      = errors.New("rabbitmq host is required")
	errRabbitMQPortInvalid       = errors.New("rabbitmq port must be greater than 0")
	errRabbitMQPublishNacked     = errors.New("rabbitmq publish confirm nack")
	errRabbitMQPublishNoConfirm  = errors.New("rabbitmq publish confirm missing")
)

// RabbitMQBrokerConfig 保存 RabbitMQ 连接参数。
type RabbitMQBrokerConfig struct {
	Enabled               bool
	Host                  string
	Port                  int
	User                  string
	Password              string
	VHost                 string
	PublishConfirmTimeout time.Duration
}

// RabbitMQTaskMessage 表示新版自包含文档同步任务消息。
type RabbitMQTaskMessage struct {
	Kind              string           `json:"kind"`
	KnowledgeBaseCode string           `json:"knowledge_base_code"`
	DocumentCode      string           `json:"document_code"`
	Mode              string           `json:"mode"`
	Async             *bool            `json:"async"`
	Key               string           `json:"key,omitempty"`
	Payload           *json.RawMessage `json:"payload"`
	RequestID         string           `json:"request_id,omitempty"`
}

func newRabbitMQTaskMessage(task *Task) (RabbitMQTaskMessage, bool) {
	if task == nil {
		return RabbitMQTaskMessage{}, false
	}
	payload := json.RawMessage(bytes.TrimSpace(task.Payload))
	async := task.Async
	return RabbitMQTaskMessage{
		Kind:              strings.TrimSpace(task.Kind),
		KnowledgeBaseCode: strings.TrimSpace(task.KnowledgeBaseCode),
		DocumentCode:      strings.TrimSpace(task.Code),
		Mode:              strings.TrimSpace(task.Mode),
		Async:             &async,
		Key:               strings.TrimSpace(task.Key),
		Payload:           &payload,
		RequestID:         strings.TrimSpace(task.RequestID),
	}, true
}

// RabbitMQDelivery 适配一次 RabbitMQ 投递。
type RabbitMQDelivery interface {
	Body() []byte
	Ack(multiple bool) error
	Nack(multiple, requeue bool) error
}

// RabbitMQConsumer 表示一个消费会话。
type RabbitMQConsumer interface {
	Deliveries() <-chan RabbitMQDelivery
	Close() error
}

// RabbitMQBroker 封装 RabbitMQ 发布/消费连接管理。
// 当前模型固定为：
// - 发布侧复用一条共享 publish connection，并按次创建 publish channel
// - 消费侧复用一条共享 consume connection，并按次创建 consume channel
// - 发布和消费连接彼此独立，不共享同一条 AMQP connection
type RabbitMQBroker struct {
	logger *logging.SugaredLogger
	config RabbitMQBrokerConfig

	mu sync.Mutex
	// publishConn 仅供发布 task 使用；单 connection，多 channel。
	publishConn *rabbitMQConnection
	// consumeConn 仅供消费 task 使用；单 connection，多 channel。
	consumeConn *rabbitMQConnection
	dial        rabbitMQDialFunc
}

// NewRabbitMQBroker 创建 RabbitMQ broker。
func NewRabbitMQBroker(config RabbitMQBrokerConfig, logger *logging.SugaredLogger) *RabbitMQBroker {
	return &RabbitMQBroker{
		logger: logger,
		config: config,
		dial:   defaultRabbitMQDial,
	}
}

// ValidateConfig 校验并规范化 RabbitMQ 连接参数。
func (b *RabbitMQBroker) ValidateConfig() error {
	_, _, err := buildRabbitMQConnectionURL(b.config)
	return err
}

// Enabled 返回当前 broker 是否启用。
func (b *RabbitMQBroker) Enabled() bool {
	return b != nil && b.config.Enabled
}

// PublishTask 发布新版自包含 task 消息。
func (b *RabbitMQBroker) PublishTask(ctx context.Context, queue string, message RabbitMQTaskMessage) error {
	if !b.Enabled() {
		return nil
	}

	conn, err := b.ensurePublishConnection()
	if err != nil {
		return err
	}

	channel, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open rabbitmq task publish channel: %w", err)
	}
	defer func() {
		_ = channel.Close()
	}()

	declareCtx, cancel := b.withDeclareTimeout(ctx)
	defer cancel()
	if err := b.declareQueue(declareCtx, channel, queue); err != nil {
		return err
	}

	body, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("marshal rabbitmq task message: %w", err)
	}

	if err := channel.EnablePublishConfirm(); err != nil {
		return fmt.Errorf("enable rabbitmq task publish confirm: %w", err)
	}
	if err := publishMessageOnRabbitMQChannel(ctx, channel, queue, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
		Timestamp:    time.Now(),
	}, b.publishConfirmTimeout()); err != nil {
		return fmt.Errorf("publish rabbitmq task message: %w", err)
	}
	b.logPublishedTask(ctx, queue, body)
	return nil
}

func (b *RabbitMQBroker) publishConfirmTimeout() time.Duration {
	if b != nil && b.config.PublishConfirmTimeout > 0 {
		return b.config.PublishConfirmTimeout
	}
	return defaultMQPublishTimeout
}

func waitRabbitMQPublishConfirm(
	ctx context.Context,
	confirmation *amqp.DeferredConfirmation,
	confirmTimeout time.Duration,
) error {
	if confirmation == nil {
		return errRabbitMQPublishNoConfirm
	}
	if confirmTimeout <= 0 {
		confirmTimeout = defaultMQPublishTimeout
	}
	confirmCtx, cancel := context.WithTimeout(ctx, confirmTimeout)
	defer cancel()

	acked, err := confirmation.WaitContext(confirmCtx)
	if err != nil {
		return fmt.Errorf("wait rabbitmq publish confirm: %w", err)
	}
	if !acked {
		return errRabbitMQPublishNacked
	}
	return nil
}

func (b *RabbitMQBroker) logPublishedTask(ctx context.Context, queue string, body []byte) {
	if b == nil || b.logger == nil {
		return
	}
	b.logger.InfoContext(
		ctx,
		rabbitMQDocumentResyncLogKey+" publish task message",
		"queue", strings.TrimSpace(queue),
		rabbitMQMessageContentLogFieldKey, string(body),
	)
}

// NewConsumer 创建消费会话。
// 消费侧始终走共享的 consume connection，再为该会话打开一个 consume channel。
func (b *RabbitMQBroker) NewConsumer(
	ctx context.Context,
	queue string,
	prefetch int,
	consumerTag string,
) (RabbitMQConsumer, error) {
	if !b.Enabled() {
		return noopRabbitMQConsumer{}, nil
	}

	conn, err := b.ensureConsumeConnection()
	if err != nil {
		return nil, err
	}

	channel, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("open rabbitmq consume channel: %w", err)
	}

	declareCtx, cancel := b.withDeclareTimeout(ctx)
	if err := b.declareQueue(declareCtx, channel, queue); err != nil {
		cancel()
		_ = channel.Close()
		return nil, err
	}
	cancel()

	consumeCtx, consumeCancel := context.WithCancel(ctx)

	if prefetch > 0 {
		if err := channel.Qos(prefetch); err != nil {
			consumeCancel()
			_ = channel.Close()
			return nil, fmt.Errorf("set rabbitmq qos: %w", err)
		}
	}

	deliveries, err := channel.Consume(queue, consumerTag)
	if err != nil {
		consumeCancel()
		_ = channel.Close()
		return nil, fmt.Errorf("consume rabbitmq queue: %w", err)
	}

	consumer := &rabbitMQConsumer{
		channel:    channel,
		deliveries: make(chan RabbitMQDelivery),
		cancel:     consumeCancel,
		done:       make(chan struct{}),
	}
	b.watchConsumerClose(consumeCtx, conn, channel, queue, consumerTag)
	b.logConsumerStarted(ctx, queue, consumerTag, prefetch)
	go consumer.forward(consumeCtx, deliveries)
	return consumer, nil
}

func (b *RabbitMQBroker) watchConsumerClose(
	ctx context.Context,
	conn *rabbitMQConnection,
	channel *rabbitMQChannel,
	queue string,
	consumerTag string,
) {
	if b == nil || b.logger == nil {
		return
	}
	b.watchConsumerCloseSource(ctx, conn.NotifyClose(make(chan *amqp.Error, 1)), queue, consumerTag, "consume_connection")
	b.watchConsumerCloseSource(ctx, channel.NotifyClose(make(chan *amqp.Error, 1)), queue, consumerTag, "consume_channel")
}

func (b *RabbitMQBroker) watchConsumerCloseSource(
	ctx context.Context,
	notify <-chan *amqp.Error,
	queue string,
	consumerTag string,
	closeSource string,
) {
	if notify == nil {
		return
	}
	runguard.Go(ctx, runguard.Options{
		Scope:  "rabbitmq.consumer_close_watch",
		Policy: runguard.Continue,
		Fields: []any{
			"queue", queue,
			"consumer_tag", consumerTag,
			"close_source", closeSource,
		},
		OnPanic: func(ctx context.Context, report runguard.Report) {
			if b.logger != nil {
				b.logger.KnowledgeErrorContext(ctx, "Rabbitmq consumer close watcher panic recovered", report.Fields...)
			}
		},
	}, func() {
		select {
		case <-ctx.Done():
			return
		case amqpErr, ok := <-notify:
			if !ok || amqpErr == nil {
				return
			}
			b.logConsumerClosed(ctx, queue, consumerTag, closeSource, amqpErr)
		}
	})
}

func (b *RabbitMQBroker) logConsumerStarted(ctx context.Context, queue, consumerTag string, prefetch int) {
	if b == nil || b.logger == nil {
		return
	}
	b.logger.InfoContext(
		ctx,
		rabbitMQDocumentResyncLogKey+" consumer started",
		"queue", strings.TrimSpace(queue),
		"consumer_tag", strings.TrimSpace(consumerTag),
		"prefetch", prefetch,
	)
}

func (b *RabbitMQBroker) logConsumerClosed(
	ctx context.Context,
	queue string,
	consumerTag string,
	closeSource string,
	amqpErr *amqp.Error,
) {
	if b == nil || b.logger == nil || amqpErr == nil {
		return
	}
	b.logger.KnowledgeWarnContext(
		ctx,
		rabbitMQDocumentResyncLogKey+" consumer closed",
		"queue", strings.TrimSpace(queue),
		"consumer_tag", strings.TrimSpace(consumerTag),
		"close_source", closeSource,
		"amqp_code", amqpErr.Code,
		"amqp_reason", amqpErr.Reason,
	)
}

// Close 关闭 broker 持有的两条共享 connection。
func (b *RabbitMQBroker) Close() error {
	if b == nil {
		return nil
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	var closeErrs []error
	if b.publishConn != nil {
		if err := b.publishConn.Close(); err != nil {
			closeErrs = append(closeErrs, fmt.Errorf("close rabbitmq publish connection: %w", err))
		}
		b.publishConn = nil
	}
	if b.consumeConn != nil {
		if err := b.consumeConn.Close(); err != nil {
			closeErrs = append(closeErrs, fmt.Errorf("close rabbitmq consume connection: %w", err))
		}
		b.consumeConn = nil
	}
	if len(closeErrs) > 0 {
		return fmt.Errorf("close rabbitmq broker connections: %w", errors.Join(closeErrs...))
	}
	return nil
}

func (b *RabbitMQBroker) ensurePublishConnection() (*rabbitMQConnection, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.ensureConnectionLocked(&b.publishConn)
}

func (b *RabbitMQBroker) ensureConsumeConnection() (*rabbitMQConnection, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.ensureConnectionLocked(&b.consumeConn)
}

func (b *RabbitMQBroker) ensureConnectionLocked(connRef **rabbitMQConnection) (*rabbitMQConnection, error) {
	if *connRef != nil && !(*connRef).IsClosed() {
		return *connRef, nil
	}

	connURL, normalized, err := buildRabbitMQConnectionURL(b.config)
	if err != nil {
		return nil, err
	}

	conn, err := b.dial(connURL)
	if err != nil {
		return nil, fmt.Errorf(
			"dial rabbitmq host=%q port=%d user=%q vhost=%q: %w",
			normalized.Host,
			normalized.Port,
			normalized.User,
			normalized.VHost,
			err,
		)
	}
	*connRef = conn
	return conn, nil
}

func buildRabbitMQConnectionURL(config RabbitMQBrokerConfig) (string, RabbitMQBrokerConfig, error) {
	normalized := normalizeRabbitMQBrokerConfig(config)
	switch {
	case normalized.Host == "":
		return "", normalized, fmt.Errorf(
			"validate rabbitmq config host=%q port=%d user=%q vhost=%q: %w",
			normalized.Host,
			normalized.Port,
			normalized.User,
			normalized.VHost,
			errRabbitMQHostRequired,
		)
	case normalized.Port <= 0:
		return "", normalized, fmt.Errorf(
			"validate rabbitmq config host=%q port=%d user=%q vhost=%q: %w",
			normalized.Host,
			normalized.Port,
			normalized.User,
			normalized.VHost,
			errRabbitMQPortInvalid,
		)
	}

	connURL := fmt.Sprintf(
		"amqp://%s@%s/%s",
		url.UserPassword(normalized.User, normalized.Password).String(),
		net.JoinHostPort(normalized.Host, strconv.Itoa(normalized.Port)),
		escapeVHost(normalized.VHost),
	)
	if _, err := url.Parse(connURL); err != nil {
		return "", normalized, fmt.Errorf(
			"validate rabbitmq config host=%q port=%d user=%q vhost=%q: %w",
			normalized.Host,
			normalized.Port,
			normalized.User,
			normalized.VHost,
			err,
		)
	}
	return connURL, normalized, nil
}

func normalizeRabbitMQBrokerConfig(config RabbitMQBrokerConfig) RabbitMQBrokerConfig {
	config.Host = strings.TrimSpace(config.Host)
	config.User = strings.TrimSpace(config.User)
	config.VHost = strings.TrimSpace(config.VHost)
	if config.VHost == "" {
		config.VHost = "/"
	}
	return config
}

func (b *RabbitMQBroker) declareQueue(ctx context.Context, channel *rabbitMQChannel, queue string) error {
	if queue == "" {
		return errRabbitMQQueueNameRequired
	}
	if err := channel.QueueDeclare(queue, nil); err != nil {
		return fmt.Errorf("declare rabbitmq queue %q: %w", queue, err)
	}

	if err := ctx.Err(); err != nil {
		return fmt.Errorf("declare rabbitmq queue context done: %w", err)
	}
	return nil
}

func (b *RabbitMQBroker) withDeclareTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithTimeout(ctx, rabbitMQDeclareTimeout)
}

func escapeVHost(vhost string) string {
	if vhost == "" || vhost == "/" {
		return "%2F"
	}
	return url.PathEscape(vhost)
}

type rabbitMQConsumer struct {
	channel    *rabbitMQChannel
	deliveries chan RabbitMQDelivery
	cancel     context.CancelFunc
	done       chan struct{}
}

type rabbitMQDialFunc func(url string) (*rabbitMQConnection, error)

type rabbitMQConnection struct {
	openChannel func() (*rabbitMQChannel, error)
	close       func() error
	isClosed    func() bool
	notifyClose func(receiver chan *amqp.Error) chan *amqp.Error
}

func (c *rabbitMQConnection) Channel() (*rabbitMQChannel, error) {
	if c == nil || c.openChannel == nil {
		return nil, errRabbitMQNilChannelOpener
	}
	return c.openChannel()
}

func (c *rabbitMQConnection) Close() error {
	if c == nil || c.close == nil {
		return nil
	}
	return c.close()
}

func (c *rabbitMQConnection) IsClosed() bool {
	if c == nil || c.isClosed == nil {
		return true
	}
	return c.isClosed()
}

func (c *rabbitMQConnection) NotifyClose(receiver chan *amqp.Error) chan *amqp.Error {
	if c == nil || c.notifyClose == nil {
		close(receiver)
		return receiver
	}
	return c.notifyClose(receiver)
}

type rabbitMQChannel struct {
	queueDeclare   func(queue string, args amqp.Table) error
	enableConfirm  func() error
	publishMessage func(ctx context.Context, queue string, msg amqp.Publishing, confirmTimeout time.Duration) error
	setQos         func(prefetch int) error
	consume        func(queue, consumer string) (<-chan amqp.Delivery, error)
	close          func() error
	notifyClose    func(receiver chan *amqp.Error) chan *amqp.Error
}

func (c *rabbitMQChannel) QueueDeclare(queue string, args amqp.Table) error {
	if c == nil || c.queueDeclare == nil {
		return errRabbitMQNilQueueDeclarer
	}
	return c.queueDeclare(queue, args)
}

func (c *rabbitMQChannel) EnablePublishConfirm() error {
	if c == nil || c.enableConfirm == nil {
		return errRabbitMQNilConfirmEnabler
	}
	return c.enableConfirm()
}

func publishMessageOnRabbitMQChannel(
	ctx context.Context,
	channel *rabbitMQChannel,
	queue string,
	msg amqp.Publishing,
	confirmTimeout time.Duration,
) error {
	if channel == nil || channel.publishMessage == nil {
		return errRabbitMQNilPublisher
	}
	return channel.publishMessage(ctx, queue, msg, confirmTimeout)
}

func (c *rabbitMQChannel) Qos(prefetch int) error {
	if c == nil || c.setQos == nil {
		return errRabbitMQNilQosSetter
	}
	return c.setQos(prefetch)
}

func (c *rabbitMQChannel) Consume(queue, consumer string) (<-chan amqp.Delivery, error) {
	if c == nil || c.consume == nil {
		return nil, errRabbitMQNilConsumer
	}
	return c.consume(queue, consumer)
}

func (c *rabbitMQChannel) Close() error {
	if c == nil || c.close == nil {
		return nil
	}
	return c.close()
}

func (c *rabbitMQChannel) NotifyClose(receiver chan *amqp.Error) chan *amqp.Error {
	if c == nil || c.notifyClose == nil {
		close(receiver)
		return receiver
	}
	return c.notifyClose(receiver)
}

func defaultRabbitMQDial(url string) (*rabbitMQConnection, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("amqp dial: %w", err)
	}
	return newRabbitMQConnection(conn), nil
}

func newRabbitMQConnection(conn *amqp.Connection) *rabbitMQConnection {
	return &rabbitMQConnection{
		openChannel: func() (*rabbitMQChannel, error) {
			channel, err := conn.Channel()
			if err != nil {
				return nil, fmt.Errorf("amqp open channel: %w", err)
			}
			return newRabbitMQChannel(channel), nil
		},
		close: func() error {
			if err := conn.Close(); err != nil {
				return fmt.Errorf("amqp close connection: %w", err)
			}
			return nil
		},
		isClosed:    conn.IsClosed,
		notifyClose: conn.NotifyClose,
	}
}

func newRabbitMQChannel(channel *amqp.Channel) *rabbitMQChannel {
	return &rabbitMQChannel{
		queueDeclare: func(queue string, args amqp.Table) error {
			_, err := channel.QueueDeclare(queue, true, false, false, false, args)
			if err != nil {
				return fmt.Errorf("amqp queue declare: %w", err)
			}
			return nil
		},
		enableConfirm: func() error {
			if err := channel.Confirm(false); err != nil {
				return fmt.Errorf("amqp enable publish confirm: %w", err)
			}
			return nil
		},
		publishMessage: func(ctx context.Context, queue string, msg amqp.Publishing, confirmTimeout time.Duration) error {
			confirmation, err := channel.PublishWithDeferredConfirmWithContext(ctx, "", queue, false, false, msg)
			if err != nil {
				return fmt.Errorf("amqp publish message: %w", err)
			}
			return waitRabbitMQPublishConfirm(ctx, confirmation, confirmTimeout)
		},
		setQos: func(prefetch int) error {
			if err := channel.Qos(prefetch, 0, false); err != nil {
				return fmt.Errorf("amqp set qos: %w", err)
			}
			return nil
		},
		consume: func(queue, consumer string) (<-chan amqp.Delivery, error) {
			deliveries, err := channel.Consume(queue, consumer, false, false, false, false, nil)
			if err != nil {
				return nil, fmt.Errorf("amqp consume: %w", err)
			}
			return deliveries, nil
		},
		close: func() error {
			if err := channel.Close(); err != nil {
				return fmt.Errorf("amqp close channel: %w", err)
			}
			return nil
		},
		notifyClose: channel.NotifyClose,
	}
}

type noopRabbitMQConsumer struct{}

func (noopRabbitMQConsumer) Deliveries() <-chan RabbitMQDelivery {
	deliveries := make(chan RabbitMQDelivery)
	close(deliveries)
	return deliveries
}

func (noopRabbitMQConsumer) Close() error {
	return nil
}

func (c *rabbitMQConsumer) Deliveries() <-chan RabbitMQDelivery {
	return c.deliveries
}

func (c *rabbitMQConsumer) Close() error {
	if c.cancel != nil {
		c.cancel()
	}
	defer func() {
		if c.done != nil {
			<-c.done
		}
	}()
	if c.channel == nil {
		return nil
	}
	if err := c.channel.Close(); err != nil {
		if errors.Is(err, amqp.ErrClosed) {
			return nil
		}
		return fmt.Errorf("close rabbitmq consume channel: %w", err)
	}
	return nil
}

func (c *rabbitMQConsumer) forward(ctx context.Context, deliveries <-chan amqp.Delivery) {
	defer close(c.done)
	defer close(c.deliveries)
	for {
		select {
		case <-ctx.Done():
			return
		case delivery, ok := <-deliveries:
			if !ok {
				return
			}
			select {
			case <-ctx.Done():
				return
			case c.deliveries <- rabbitMQDelivery{delivery: delivery}:
			}
		}
	}
}

type rabbitMQDelivery struct {
	delivery amqp.Delivery
}

func (d rabbitMQDelivery) Body() []byte {
	return d.delivery.Body
}

func (d rabbitMQDelivery) Ack(multiple bool) error {
	if err := d.delivery.Ack(multiple); err != nil {
		return fmt.Errorf("ack rabbitmq delivery: %w", err)
	}
	return nil
}

func (d rabbitMQDelivery) Nack(multiple, requeue bool) error {
	if err := d.delivery.Nack(multiple, requeue); err != nil {
		return fmt.Errorf("nack rabbitmq delivery: %w", err)
	}
	return nil
}
