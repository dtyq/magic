<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\Agent;

use App\Domain\Chat\Event\Agent\AgentExecuteInterface;
use App\Domain\Chat\Event\Agent\UserCallAgentEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

#[Listener]
class UserCallAgentSubscriber implements ListenerInterface
{
    protected LoggerInterface $logger;

    protected ContainerInterface $container;

    public function __construct(
        ContainerInterface $container,
    ) {
        $this->container = $container;
        $this->logger = $container->get(LoggerFactory::class)->get(static::class);
    }

    public function listen(): array
    {
        return [
            UserCallAgentEvent::class,
        ];
    }

    public function process(object $event): void
    {
        /* @var UserCallAgentEvent $event */
        di(AgentExecuteInterface::class)->agentExecEvent($event);
    }
}
