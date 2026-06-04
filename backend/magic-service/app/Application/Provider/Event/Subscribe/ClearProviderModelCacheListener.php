<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Event\Subscribe;

use App\Domain\Provider\Event\ProviderConfigCreatedEvent;
use App\Domain\Provider\Event\ProviderConfigUpdatedEvent;
use App\Domain\Provider\Event\ProviderModelCreatedEvent;
use App\Domain\Provider\Event\ProviderModelDeletedEvent;
use App\Domain\Provider\Event\ProviderModelUpdatedEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;

/**
 * Provider model events listener.
 */
#[Listener]
class ClearProviderModelCacheListener implements ListenerInterface
{
    public function listen(): array
    {
        return [
            ProviderConfigCreatedEvent::class,
            ProviderConfigUpdatedEvent::class,
            ProviderModelCreatedEvent::class,
            ProviderModelUpdatedEvent::class,
            ProviderModelDeletedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        // Provider model cache removed; intentionally no-op.
    }
}
