<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\SuperMagic\Application\SuperAgent\Service\WarmPoolSandboxAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\SandboxAgentImageChangedEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Drops every still-pending warm-pool sandbox running the previous agent
 * image generation so the pool refill loop can repopulate using the latest
 * image.
 *
 * Idempotent with the crontab's inline invalidation call — both reach the
 * same application method which deletes by image+status.
 */
#[Listener]
class InvalidateWarmPoolSandboxesOnAgentImageChangeSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly WarmPoolSandboxAppService $warmPoolSandboxAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            SandboxAgentImageChangedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof SandboxAgentImageChangedEvent) {
            return;
        }
        try {
            $summary = $this->warmPoolSandboxAppService->invalidateStaleImageGeneration($event->getCurrentImage());
            $this->logger->info('[WarmPoolSandbox] image change event handled', [
                'previous_image' => $event->getPreviousImage(),
                'current_image' => $event->getCurrentImage(),
                'summary' => $summary,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('[WarmPoolSandbox] image change subscriber failed', [
                'previous_image' => $event->getPreviousImage(),
                'current_image' => $event->getCurrentImage(),
                'error' => $e->getMessage(),
            ]);
        }
    }
}
