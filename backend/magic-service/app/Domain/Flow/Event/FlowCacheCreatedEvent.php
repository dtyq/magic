<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Event;

use App\Domain\Flow\Entity\MagicFlowCacheEntity;
use App\Infrastructure\Core\Event\AbstractDomainEvent;

/**
 * 缓存创建事件.
 */
class FlowCacheCreatedEvent extends AbstractDomainEvent
{
    public function __construct(private MagicFlowCacheEntity $entity)
    {
        parent::__construct();
    }

    public function getEntity(): MagicFlowCacheEntity
    {
        return $this->entity;
    }

    public function getEventName(): string
    {
        return 'flow.cache.created';
    }
}
