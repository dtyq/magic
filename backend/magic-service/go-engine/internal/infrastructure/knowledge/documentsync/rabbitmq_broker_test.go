package documentsync_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"magic/internal/infrastructure/knowledge/documentsync"
	"magic/internal/infrastructure/logging"
)

func TestRabbitMQBrokerUsesSeparatePublishAndConsumeConnections(t *testing.T) {
	t.Parallel()

	publishConnState := &rabbitMQConnectionStub{}
	consumeConnState := &rabbitMQConnectionStub{}
	publishConn := newRabbitMQConnectionStub(publishConnState)
	consumeConn := newRabbitMQConnectionStub(consumeConnState)
	dialCalls := 0

	broker := documentsync.NewRabbitMQBroker(documentsync.RabbitMQBrokerConfig{
		Enabled:  true,
		Host:     "localhost",
		Port:     5672,
		User:     "guest",
		Password: "guest",
		VHost:    "/",
	}, logging.New().Named("documentsync.rabbitmq.broker.test"))
	broker.SetDialForTest(func(string) (*documentsync.RabbitMQConnectionForTest, error) {
		dialCalls++
		if dialCalls == 1 {
			return publishConn, nil
		}
		return consumeConn, nil
	})

	if err := broker.PublishTask(context.Background(), "queue.publish", rabbitMQTaskMessageForTest("DOC-1")); err != nil {
		t.Fatalf("publish first task: %v", err)
	}
	if err := broker.PublishTask(context.Background(), "queue.publish", rabbitMQTaskMessageForTest("DOC-2")); err != nil {
		t.Fatalf("publish second task: %v", err)
	}

	consumer, err := broker.NewConsumer(context.Background(), "queue.consume", 4, "consumer-tag")
	if err != nil {
		t.Fatalf("new consumer: %v", err)
	}
	if err := consumer.Close(); err != nil {
		t.Fatalf("close consumer: %v", err)
	}

	if dialCalls != 2 {
		t.Fatalf("expected exactly 2 dial calls, got %d", dialCalls)
	}
	if publishConnState.channelCalls != 2 {
		t.Fatalf("expected publish connection to open 2 channels, got %d", publishConnState.channelCalls)
	}
	if consumeConnState.channelCalls != 1 {
		t.Fatalf("expected consume connection to open 1 channel, got %d", consumeConnState.channelCalls)
	}
	if publishConnState.closed {
		t.Fatal("expected publish connection to stay open before broker close")
	}
	if consumeConnState.closed {
		t.Fatal("expected consume connection to stay open before broker close")
	}

	if err := broker.Close(); err != nil {
		t.Fatalf("close broker: %v", err)
	}
	if !publishConnState.closed {
		t.Fatal("expected publish connection to close with broker")
	}
	if !consumeConnState.closed {
		t.Fatal("expected consume connection to close with broker")
	}
}

func TestRabbitMQConsumerCloseIgnoresAlreadyClosedChannel(t *testing.T) {
	t.Parallel()

	broker := documentsync.NewRabbitMQBroker(documentsync.RabbitMQBrokerConfig{
		Enabled:  true,
		Host:     "localhost",
		Port:     5672,
		User:     "guest",
		Password: "guest",
		VHost:    "/",
	}, logging.New().Named("documentsync.rabbitmq.broker.test"))
	broker.SetDialForTest(func(string) (*documentsync.RabbitMQConnectionForTest, error) {
		return documentsync.NewRabbitMQConnectionForTest(
			func() (*documentsync.RabbitMQChannelForTest, error) {
				return documentsync.NewRabbitMQChannelForTest(
					func(string) error { return nil },
					func(context.Context, string, amqp.Publishing) error { return nil },
					func(int) error { return nil },
					func(string, string) (<-chan amqp.Delivery, error) {
						return make(chan amqp.Delivery), nil
					},
					func() error { return amqp.ErrClosed },
				), nil
			},
			func() error { return nil },
			func() bool { return false },
		), nil
	})

	consumer, err := broker.NewConsumer(context.Background(), "queue.consume", 4, "consumer-tag")
	if err != nil {
		t.Fatalf("new consumer: %v", err)
	}
	if err := consumer.Close(); err != nil {
		t.Fatalf("expected already closed channel to be ignored, got %v", err)
	}
}

func TestRabbitMQBrokerPublishTaskBuildsEscapedConnectionURL(t *testing.T) {
	t.Parallel()

	connState := &rabbitMQConnectionStub{}
	conn := newRabbitMQConnectionStub(connState)
	var dialURL string

	broker := documentsync.NewRabbitMQBroker(documentsync.RabbitMQBrokerConfig{
		Enabled:  true,
		Host:     " 127.0.0.1 ",
		Port:     5672,
		User:     " guest ",
		Password: "p@ss:word",
		VHost:    " team/share ",
	}, logging.New().Named("documentsync.rabbitmq.broker.test"))
	broker.SetDialForTest(func(url string) (*documentsync.RabbitMQConnectionForTest, error) {
		dialURL = url
		return conn, nil
	})

	if err := broker.PublishTask(context.Background(), "queue.publish", rabbitMQTaskMessageForTest("DOC-URL")); err != nil {
		t.Fatalf("publish task: %v", err)
	}

	const wantURL = "amqp://guest:p%40ss%3Aword@127.0.0.1:5672/team%2Fshare"
	if dialURL != wantURL {
		t.Fatalf("expected dial url %q, got %q", wantURL, dialURL)
	}
	if connState.channelCalls != 1 {
		t.Fatalf("expected one publish channel, got %d", connState.channelCalls)
	}
}

func TestRabbitMQBrokerPublishTaskRejectsInvalidConnectionConfig(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name        string
		config      documentsync.RabbitMQBrokerConfig
		wantMessage string
	}{
		{
			name: "missing host",
			config: documentsync.RabbitMQBrokerConfig{
				Enabled:  true,
				Host:     "   ",
				Port:     5672,
				User:     "guest",
				Password: "guest",
				VHost:    "/",
			},
			wantMessage: "rabbitmq host is required",
		},
		{
			name: "invalid port",
			config: documentsync.RabbitMQBrokerConfig{
				Enabled:  true,
				Host:     "127.0.0.1",
				Port:     0,
				User:     "guest",
				Password: "guest",
				VHost:    "/",
			},
			wantMessage: "rabbitmq port must be greater than 0",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			dialCalled := false
			broker := documentsync.NewRabbitMQBroker(tc.config, logging.New().Named("documentsync.rabbitmq.broker.test"))
			broker.SetDialForTest(func(string) (*documentsync.RabbitMQConnectionForTest, error) {
				dialCalled = true
				return newRabbitMQConnectionStub(&rabbitMQConnectionStub{}), nil
			})

			err := broker.PublishTask(context.Background(), "queue.publish", rabbitMQTaskMessageForTest("DOC-CONFIG"))
			if err == nil {
				t.Fatal("expected publish task to fail")
			}
			if !strings.Contains(err.Error(), tc.wantMessage) {
				t.Fatalf("expected error containing %q, got %v", tc.wantMessage, err)
			}
			if dialCalled {
				t.Fatal("expected invalid config to fail before dial")
			}
		})
	}
}

func TestRabbitMQBrokerPublishTaskWaitsForConfirmAck(t *testing.T) {
	t.Parallel()

	confirmEnabled := false
	broker := documentsync.NewRabbitMQBroker(documentsync.RabbitMQBrokerConfig{
		Enabled:  true,
		Host:     "localhost",
		Port:     5672,
		User:     "guest",
		Password: "guest",
		VHost:    "/",
	}, logging.New().Named("documentsync.rabbitmq.broker.test"))
	broker.SetDialForTest(func(string) (*documentsync.RabbitMQConnectionForTest, error) {
		return documentsync.NewRabbitMQConnectionForTest(
			func() (*documentsync.RabbitMQChannelForTest, error) {
				return documentsync.NewRabbitMQChannelWithConfirmForTest(
					func(string, amqp.Table) error { return nil },
					func() error {
						confirmEnabled = true
						return nil
					},
					func(context.Context, string, amqp.Publishing) (bool, error) { return true, nil },
					func(int) error { return nil },
					func(string, string) (<-chan amqp.Delivery, error) {
						return make(chan amqp.Delivery), nil
					},
					func() error { return nil },
				), nil
			},
			func() error { return nil },
			func() bool { return false },
		), nil
	})

	if err := broker.PublishTask(context.Background(), "queue.publish", rabbitMQTaskMessageForTest("DOC-CONFIRM-ACK")); err != nil {
		t.Fatalf("publish task: %v", err)
	}
	if !confirmEnabled {
		t.Fatal("expected publisher confirm mode to be enabled")
	}
}

func TestRabbitMQBrokerPublishTaskReturnsErrorOnConfirmNack(t *testing.T) {
	t.Parallel()

	broker := documentsync.NewRabbitMQBroker(documentsync.RabbitMQBrokerConfig{
		Enabled:  true,
		Host:     "localhost",
		Port:     5672,
		User:     "guest",
		Password: "guest",
		VHost:    "/",
	}, logging.New().Named("documentsync.rabbitmq.broker.test"))
	broker.SetDialForTest(func(string) (*documentsync.RabbitMQConnectionForTest, error) {
		return documentsync.NewRabbitMQConnectionForTest(
			func() (*documentsync.RabbitMQChannelForTest, error) {
				return documentsync.NewRabbitMQChannelWithConfirmForTest(
					func(string, amqp.Table) error { return nil },
					func() error { return nil },
					func(context.Context, string, amqp.Publishing) (bool, error) { return false, nil },
					func(int) error { return nil },
					func(string, string) (<-chan amqp.Delivery, error) {
						return make(chan amqp.Delivery), nil
					},
					func() error { return nil },
				), nil
			},
			func() error { return nil },
			func() bool { return false },
		), nil
	})

	err := broker.PublishTask(context.Background(), "queue.publish", rabbitMQTaskMessageForTest("DOC-CONFIRM-NACK"))
	if err == nil || !strings.Contains(err.Error(), "nack") {
		t.Fatalf("expected confirm nack error, got %v", err)
	}
}

func TestRabbitMQBrokerPublishTaskReturnsErrorOnConfirmTimeout(t *testing.T) {
	t.Parallel()

	broker := documentsync.NewRabbitMQBroker(documentsync.RabbitMQBrokerConfig{
		Enabled:               true,
		Host:                  "localhost",
		Port:                  5672,
		User:                  "guest",
		Password:              "guest",
		VHost:                 "/",
		PublishConfirmTimeout: 10 * time.Millisecond,
	}, logging.New().Named("documentsync.rabbitmq.broker.test"))
	broker.SetDialForTest(func(string) (*documentsync.RabbitMQConnectionForTest, error) {
		return documentsync.NewRabbitMQConnectionForTest(
			func() (*documentsync.RabbitMQChannelForTest, error) {
				return documentsync.NewRabbitMQChannelWithBlockingConfirmForTest(
					func(string, amqp.Table) error { return nil },
					func() error { return nil },
					func(context.Context, string, amqp.Publishing) error { return nil },
					func(int) error { return nil },
					func(string, string) (<-chan amqp.Delivery, error) {
						return make(chan amqp.Delivery), nil
					},
					func() error { return nil },
				), nil
			},
			func() error { return nil },
			func() bool { return false },
		), nil
	})

	err := broker.PublishTask(context.Background(), "queue.publish", rabbitMQTaskMessageForTest("DOC-CONFIRM-TIMEOUT"))
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected confirm timeout deadline error, got %v", err)
	}
}

func rabbitMQTaskMessageForTest(documentCode string) documentsync.RabbitMQTaskMessage {
	async := true
	payload := json.RawMessage(`{"ok":true}`)
	return documentsync.RabbitMQTaskMessage{
		Kind:              documentsync.TaskKindDocumentSync,
		KnowledgeBaseCode: "KB-1",
		DocumentCode:      documentCode,
		Mode:              "resync",
		Async:             &async,
		Payload:           &payload,
	}
}

type rabbitMQConnectionStub struct {
	channelCalls int
	closed       bool
}

func newRabbitMQConnectionStub(state *rabbitMQConnectionStub) *documentsync.RabbitMQConnectionForTest {
	return documentsync.NewRabbitMQConnectionForTest(
		func() (*documentsync.RabbitMQChannelForTest, error) {
			state.channelCalls++
			return documentsync.NewRabbitMQChannelForTest(
				func(string) error { return nil },
				func(context.Context, string, amqp.Publishing) error { return nil },
				func(int) error { return nil },
				func(string, string) (<-chan amqp.Delivery, error) {
					return make(chan amqp.Delivery), nil
				},
				func() error { return nil },
			), nil
		},
		func() error {
			state.closed = true
			return nil
		},
		func() bool {
			return state.closed
		},
	)
}
