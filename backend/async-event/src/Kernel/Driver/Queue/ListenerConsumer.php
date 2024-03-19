<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Driver\Queue;

use Dtyq\AsyncEvent\Kernel\Executor\AsyncListenerExecutor;
use Dtyq\AsyncEvent\Kernel\Utils\ContextDataUtil;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

#[Consumer(exchange: 'async_event_listener', routingKey: 'async_event_listener', queue: 'ListenerConsumer', name: 'AsyncEvent', nums: 2)]
class ListenerConsumer extends ConsumerMessage
{
    private AsyncListenerExecutor $asyncListenerExecutor;

    private LoggerInterface $logger;

    public function __construct(
        ContainerInterface $container,
    ) {
        $this->asyncListenerExecutor = $container->get(AsyncListenerExecutor::class);
        $this->logger = $container->get(LoggerInterface::class);
    }

    public function isEnable(): bool
    {
        return config('async_event.listener_exec_driver', 'coroutine') === 'queue_amqp';
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $id = $data['id'] ?? 0;
        if (! $id) {
            return Result::ACK;
        }

        // Set context data before executing listener
        $contextData = $data['context_data'] ?? [];
        ContextDataUtil::setContextData($contextData);

        $this->logger->info('ListenerConsumerReceivedMessage', ['id' => $id, 'data' => $data]);
        $this->asyncListenerExecutor->runWithId($id);
        return Result::ACK;
    }
}
