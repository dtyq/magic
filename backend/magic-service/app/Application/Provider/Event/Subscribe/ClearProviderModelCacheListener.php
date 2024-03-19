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
use App\Infrastructure\Util\Redis\ProviderModelCacheUtil;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Clear provider model cache listener.
 * Listen to provider config and model events to clear related caches.
 */
#[Listener]
class ClearProviderModelCacheListener implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private ContainerInterface $container
    ) {
        $this->logger = $this->container->get(LoggerFactory::class)->get('ProviderModelCache');
    }

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
        try {
            match (true) {
                $event instanceof ProviderConfigCreatedEvent => $this->clearCacheForProviderConfig($event),
                $event instanceof ProviderConfigUpdatedEvent => $this->clearCacheForProviderConfig($event),
                $event instanceof ProviderModelCreatedEvent => $this->clearCacheForProviderModel($event),
                $event instanceof ProviderModelUpdatedEvent => $this->clearCacheForProviderModel($event),
                $event instanceof ProviderModelDeletedEvent => $this->clearCacheForProviderModelDeleted($event),
                default => null,
            };
        } catch (Throwable $e) {
            $this->logger->error('Clear provider model cache failed', [
                'event' => get_class($event),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Clear cache when provider config is created or updated.
     * Clear all caches for the organization since config changes may affect all models.
     */
    private function clearCacheForProviderConfig(
        ProviderConfigCreatedEvent|ProviderConfigUpdatedEvent $event
    ): void {
        $deletedCount = ProviderModelCacheUtil::deleteOrganizationProviderModels($event->organizationCode);

        $this->logger->info('Cleared provider model cache for provider config change', [
            'event' => get_class($event),
            'organization_code' => $event->organizationCode,
            'config_id' => $event->providerConfigEntity->getId(),
            'deleted_keys' => $deletedCount,
        ]);
    }

    /**
     * Clear cache when provider model is created or updated.
     * Clear all caches for the organization.
     */
    private function clearCacheForProviderModel(
        ProviderModelCreatedEvent|ProviderModelUpdatedEvent $event
    ): void {
        $deletedCount = ProviderModelCacheUtil::deleteOrganizationProviderModels($event->organizationCode);

        $this->logger->info('Cleared provider model cache for model change', [
            'event' => get_class($event),
            'organization_code' => $event->organizationCode,
            'model_id' => $event->providerModelEntity->getId(),
            'deleted_keys' => $deletedCount,
        ]);
    }

    /**
     * Clear cache when provider model is deleted.
     * Clear all caches for the organization.
     */
    private function clearCacheForProviderModelDeleted(ProviderModelDeletedEvent $event): void
    {
        $deletedCount = ProviderModelCacheUtil::deleteOrganizationProviderModels($event->organizationCode);

        $this->logger->info('Cleared provider model cache for model deletion', [
            'event' => get_class($event),
            'organization_code' => $event->organizationCode,
            'model_id' => $event->modelId,
            'deleted_keys' => $deletedCount,
        ]);
    }
}
