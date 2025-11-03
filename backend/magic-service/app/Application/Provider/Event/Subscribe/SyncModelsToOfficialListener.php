<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Event\Subscribe;

use App\Application\Provider\Service\ProviderModelSyncAppService;
use App\Domain\Provider\Event\ProviderConfigCreatedEvent;
use App\Domain\Provider\Event\ProviderConfigUpdatedEvent;
use App\Domain\Provider\Event\ProviderModelCreatedEvent;
use App\Domain\Provider\Event\ProviderModelDeletedEvent;
use App\Domain\Provider\Event\ProviderModelUpdatedEvent;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 同步模型到Official服务商监听器.
 * 监听服务商配置创建/更新、模型创建/更新/删除事件，自动同步到Official服务商.
 */
#[AsyncListener]
#[Listener]
readonly class SyncModelsToOfficialListener implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private ContainerInterface $container
    ) {
        $this->logger = $this->container->get(LoggerFactory::class)->get('ProviderModelSync');
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
            $syncService = $this->container->get(ProviderModelSyncAppService::class);

            match (true) {
                $event instanceof ProviderConfigCreatedEvent => $this->handleProviderConfigCreated($event, $syncService),
                $event instanceof ProviderConfigUpdatedEvent => $this->handleProviderConfigUpdated($event, $syncService),
                $event instanceof ProviderModelCreatedEvent => $this->handleProviderModelCreated($event, $syncService),
                $event instanceof ProviderModelUpdatedEvent => $this->handleProviderModelUpdated($event, $syncService),
                $event instanceof ProviderModelDeletedEvent => $this->handleProviderModelDeleted($event, $syncService),
                default => null,
            };
        } catch (Throwable $e) {
            $this->logger->error('同步模型到Official服务商失败', [
                'event' => get_class($event),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 处理服务商配置创建事件.
     * 如果是Official服务商创建，则同步所有非Official服务商的模型.
     */
    private function handleProviderConfigCreated(
        ProviderConfigCreatedEvent $event,
        ProviderModelSyncAppService $syncService
    ): void {
        $this->logger->info('收到服务商配置创建事件', [
            'config_id' => $event->providerConfigEntity->getId(),
            'organization_code' => $event->organizationCode,
        ]);

        $syncService->handleProviderConfigCreated(
            $event->providerConfigEntity,
            $event->organizationCode
        );
    }

    /**
     * 处理服务商配置更新事件.
     * 如果是Official服务商更新，则重新同步所有非Official服务商的模型.
     */
    private function handleProviderConfigUpdated(
        ProviderConfigUpdatedEvent $event,
        ProviderModelSyncAppService $syncService
    ): void {
        $this->logger->info('收到服务商配置更新事件', [
            'config_id' => $event->providerConfigEntity->getId(),
            'organization_code' => $event->organizationCode,
        ]);

        $syncService->handleProviderConfigUpdated(
            $event->providerConfigEntity,
            $event->organizationCode
        );
    }

    /**
     * 处理模型创建事件.
     * 如果模型属于非Official服务商，则同步到Official服务商.
     */
    private function handleProviderModelCreated(
        ProviderModelCreatedEvent $event,
        ProviderModelSyncAppService $syncService
    ): void {
        $this->logger->info('收到模型创建事件', [
            'model_id' => $event->providerModelEntity->getId(),
            'config_id' => $event->providerModelEntity->getServiceProviderConfigId(),
            'organization_code' => $event->organizationCode,
        ]);

        $syncService->handleProviderModelCreated(
            $event->providerModelEntity,
            $event->organizationCode
        );
    }

    /**
     * 处理模型更新事件.
     * 如果模型属于非Official服务商，则更新Official服务商的对应模型.
     */
    private function handleProviderModelUpdated(
        ProviderModelUpdatedEvent $event,
        ProviderModelSyncAppService $syncService
    ): void {
        $this->logger->info('收到模型更新事件', [
            'model_id' => $event->providerModelEntity->getId(),
            'config_id' => $event->providerModelEntity->getServiceProviderConfigId(),
            'organization_code' => $event->organizationCode,
        ]);

        $syncService->handleProviderModelUpdated(
            $event->providerModelEntity,
            $event->organizationCode
        );
    }

    /**
     * 处理模型删除事件.
     * 如果模型属于非Official服务商，则删除Official服务商的对应模型.
     */
    private function handleProviderModelDeleted(
        ProviderModelDeletedEvent $event,
        ProviderModelSyncAppService $syncService
    ): void {
        $this->logger->info('收到模型删除事件', [
            'model_id' => $event->modelId,
            'config_id' => $event->serviceProviderConfigId,
            'organization_code' => $event->organizationCode,
        ]);

        $syncService->handleProviderModelDeleted(
            $event->modelId,
            $event->serviceProviderConfigId,
            $event->organizationCode
        );
    }
}
