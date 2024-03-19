<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\AsyncEvent\Kernel\Driver;

use Dtyq\AsyncEvent\Kernel\Persistence\Model\AsyncEventModel;
use Dtyq\AsyncEvent\Kernel\Utils\ContextDataUtil;
use Hyperf\Amqp\Producer;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;

class QueueAMQPListenerAsyncDriver implements ListenerAsyncDriverInterface
{
    private Producer $producer;

    private LoggerInterface $logger;

    public function __construct(ContainerInterface $container)
    {
        // 检测是否已经安装了 amqp 组件
        if (! class_exists(Producer::class)) {
            throw new RuntimeException('Please install the amqp component first: composer require hyperf/amqp');
        }

        $this->producer = $container->get(Producer::class);
        $this->logger = $container->get(LoggerInterface::class);
    }

    public function publish(AsyncEventModel $asyncEventModel, object $event, callable $listener): void
    {
        // Read context data based on config
        $contextData = ContextDataUtil::readContextData();

        $this->producer->produce(new Queue\ListenerProducerMessage($asyncEventModel->id, $contextData));
        $this->logger->info('AsyncEventPublishedToAMQP', [
            'async_event_id' => $asyncEventModel->id,
            'listener' => $asyncEventModel->listener,
            'event' => $asyncEventModel->event,
        ]);
    }
}
