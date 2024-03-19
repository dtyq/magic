<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Event\Subscribe;

use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Event\MagicFlowPublishedEvent;
use App\Domain\Flow\Service\MagicFlowDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;

#[Listener]
readonly class MagicFlowCreateRoutineSubscriber implements ListenerInterface
{
    public function __construct(private ContainerInterface $container)
    {
    }

    public function listen(): array
    {
        return [
            MagicFlowPublishedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof MagicFlowPublishedEvent) {
            return;
        }
        $magicFlow = $event->magicFlowEntity;

        $this->container->get(MagicFlowDomainService::class)->createRoutine(FlowDataIsolation::create(), $magicFlow);
    }
}
