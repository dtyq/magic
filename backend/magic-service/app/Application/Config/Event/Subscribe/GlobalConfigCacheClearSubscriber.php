<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Config\Event\Subscribe;

use App\Domain\Agent\Event\MagicAgentDeletedEvent;
use App\Domain\Agent\Event\MagicAgentSavedEvent;
use App\Domain\Flow\Event\MagicFLowToolSetSavedEvent;
use App\Domain\MCP\Event\MCPServerSavedEvent;
use App\Infrastructure\Util\Redis\GlobalConfigCacheUtil;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Global Config Cache Clear Subscriber.
 * Listens to domain events and clears related cache when data changes.
 */
#[Listener]
class GlobalConfigCacheClearSubscriber implements ListenerInterface
{
    public function __construct(
        private readonly LoggerInterface $logger
    ) {
    }

    public function listen(): array
    {
        return [
            MagicAgentSavedEvent::class,
            MagicAgentDeletedEvent::class,
            MCPServerSavedEvent::class,
            MagicFLowToolSetSavedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        try {
            $this->clearGlobalDataQueriesCache($event);
        } catch (Throwable $e) {
            $this->logger->error('Failed to clear global config cache', [
                'event' => get_class($event),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
        }
    }

    /**
     * Clear global data queries cache for all users.
     */
    private function clearGlobalDataQueriesCache(object $event): void
    {
        $eventType = get_class($event);
        $organizationCode = $this->getOrganizationCodeFromEvent($event);

        // Clear all users' global data queries cache
        $deletedCount = GlobalConfigCacheUtil::deleteAllGlobalDataQueries();

        $this->logger->info('Global data queries cache cleared for all users', [
            'event_type' => $eventType,
            'organization_code' => $organizationCode,
            'keys_deleted' => $deletedCount,
        ]);
    }

    /**
     * Get organization code from event for logging.
     */
    private function getOrganizationCodeFromEvent(object $event): ?string
    {
        return match (true) {
            $event instanceof MagicAgentSavedEvent => $event->agentEntity->getOrganizationCode(),
            $event instanceof MagicAgentDeletedEvent => $event->agentEntity->getOrganizationCode(),
            $event instanceof MCPServerSavedEvent => $event->MCPServerEntity->getOrganizationCode(),
            $event instanceof MagicFLowToolSetSavedEvent => $event->toolSetEntity->getOrganizationCode(),
            default => null,
        };
    }
}
