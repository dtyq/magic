<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\SuperMagic\Application\SuperAgent\Service\WarmPoolSandboxAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\SandboxImageChangedEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Drops every still-pending warm-pool sandbox running the previous sandbox
 * image generation so the pool refill loop can repopulate using the latest
 * image.
 *
 * Idempotent with the crontab's inline invalidation call — both reach the
 * same application method which deletes by image+status.
 */
#[Listener]
class InvalidateWarmPoolSandboxesOnSandboxImageChangeSubscriber implements ListenerInterface
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
            SandboxImageChangedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof SandboxImageChangedEvent) {
            return;
        }
        try {
            $summary = $this->warmPoolSandboxAppService->invalidateStaleImageGeneration(
                $event->getCurrentAgentImage(),
                $event->getCurrentAgfsImage()
            );
            $this->logger->info('[WarmPoolSandbox] image change event handled', [
                'previous_agent_image' => $event->getPreviousAgentImage(),
                'current_agent_image' => $event->getCurrentAgentImage(),
                'previous_agfs_image' => $event->getPreviousAgfsImage(),
                'current_agfs_image' => $event->getCurrentAgfsImage(),
                'summary' => $summary,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('[WarmPoolSandbox] image change subscriber failed', [
                'previous_agent_image' => $event->getPreviousAgentImage(),
                'current_agent_image' => $event->getCurrentAgentImage(),
                'previous_agfs_image' => $event->getPreviousAgfsImage(),
                'current_agfs_image' => $event->getCurrentAgfsImage(),
                'error' => $e->getMessage(),
            ]);
        }
    }
}
