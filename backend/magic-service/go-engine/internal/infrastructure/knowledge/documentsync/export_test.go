package documentsync

import (
	"context"
	"fmt"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type (
	RabbitMQConnectionForTest = rabbitMQConnection
	RabbitMQChannelForTest    = rabbitMQChannel
)

const ResyncModeForTest = resyncMode

func (s *RabbitMQScheduler) HandleDeliveryForTest(ctx context.Context, delivery RabbitMQDelivery) {
	s.handleDelivery(ctx, delivery)
}

func (s *RabbitMQScheduler) SetReadinessGateForTest(gate ReadinessGate) {
	if s == nil {
		return
	}
	s.readinessGate = gate
}

func (b *RabbitMQBroker) SetDialForTest(dial func(url string) (*RabbitMQConnectionForTest, error)) {
	b.dial = func(url string) (*rabbitMQConnection, error) {
		return dial(url)
	}
}

func NewRabbitMQConnectionForTest(
	openChannel func() (*RabbitMQChannelForTest, error),
	closeConn func() error,
	isClosed func() bool,
) *RabbitMQConnectionForTest {
	return &rabbitMQConnection{
		openChannel: func() (*rabbitMQChannel, error) {
			return openChannel()
		},
		close:    closeConn,
		isClosed: isClosed,
	}
}

func NewRabbitMQChannelForTest(
	queueDeclare func(queue string) error,
	publishMessage func(ctx context.Context, queue string, msg amqp.Publishing) error,
	setQos func(prefetch int) error,
	consume func(queue, consumer string) (<-chan amqp.Delivery, error),
	closeChannel func() error,
) *RabbitMQChannelForTest {
	return &rabbitMQChannel{
		queueDeclare: func(queue string, _ amqp.Table) error {
			return queueDeclare(queue)
		},
		enableConfirm: func() error { return nil },
		publishMessage: func(ctx context.Context, queue string, msg amqp.Publishing, _ time.Duration) error {
			return publishMessage(ctx, queue, msg)
		},
		setQos:  setQos,
		consume: consume,
		close:   closeChannel,
	}
}

func NewRabbitMQChannelWithConfirmForTest(
	queueDeclare func(queue string, args amqp.Table) error,
	enableConfirm func() error,
	publishMessage func(ctx context.Context, queue string, msg amqp.Publishing) (bool, error),
	setQos func(prefetch int) error,
	consume func(queue, consumer string) (<-chan amqp.Delivery, error),
	closeChannel func() error,
) *RabbitMQChannelForTest {
	return &rabbitMQChannel{
		queueDeclare:  queueDeclare,
		enableConfirm: enableConfirm,
		publishMessage: func(ctx context.Context, queue string, msg amqp.Publishing, _ time.Duration) error {
			acked, err := publishMessage(ctx, queue, msg)
			if err != nil {
				return err
			}
			if !acked {
				return errRabbitMQPublishNacked
			}
			return nil
		},
		setQos:  setQos,
		consume: consume,
		close:   closeChannel,
	}
}

func NewRabbitMQChannelWithBlockingConfirmForTest(
	queueDeclare func(queue string, args amqp.Table) error,
	enableConfirm func() error,
	publishMessage func(ctx context.Context, queue string, msg amqp.Publishing) error,
	setQos func(prefetch int) error,
	consume func(queue, consumer string) (<-chan amqp.Delivery, error),
	closeChannel func() error,
) *RabbitMQChannelForTest {
	return &rabbitMQChannel{
		queueDeclare:  queueDeclare,
		enableConfirm: enableConfirm,
		publishMessage: func(ctx context.Context, queue string, msg amqp.Publishing, confirmTimeout time.Duration) error {
			if err := publishMessage(ctx, queue, msg); err != nil {
				return err
			}
			confirmCtx, cancel := context.WithTimeout(ctx, confirmTimeout)
			defer cancel()
			return waitBlockingRabbitMQConfirmationForTest(confirmCtx)
		},
		setQos:  setQos,
		consume: consume,
		close:   closeChannel,
	}
}

func waitBlockingRabbitMQConfirmationForTest(ctx context.Context) error {
	<-ctx.Done()
	return fmt.Errorf("wait blocking rabbitmq confirmation for test: %w", ctx.Err())
}
