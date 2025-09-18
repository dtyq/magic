<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Event\Subscribe;

use App\Application\Speech\Event\AsrSummaryRequestedEvent;
use App\Application\Speech\Service\AsrFileAppService;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;

#[AsyncListener]
#[Listener]
class AsrSummaryRequestedSubscriber implements ListenerInterface
{
    public function __construct(private readonly AsrFileAppService $asrFileAppService)
    {
    }

    public function listen(): array
    {
        return [AsrSummaryRequestedEvent::class];
    }

    public function process(object $event): void
    {
        if (! $event instanceof AsrSummaryRequestedEvent) {
            return;
        }
        $this->asrFileAppService->handleAsrSummaryEvent($event);
    }
}
