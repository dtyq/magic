<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskCallbackEvent;
use Hyperf\Event\Contract\ListenerInterface;

/**
 * RunTaskCallbackEvent事件监听器 - 录音总结完成检测.
 */
class RunTaskCallbackEventSubscriber implements ListenerInterface
{
    public function __construct(
    ) {
    }

    /**
     * Listen to events.
     *
     * @return array Array of event classes to listen to
     */
    public function listen(): array
    {
        return [
            RunTaskCallbackEvent::class,
        ];
    }

    /**
     * Process the event.
     *
     * @param object $event Event object
     */
    public function process(object $event): void
    {
    }
}
