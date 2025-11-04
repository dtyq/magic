<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Event\Subscribe;

use App\Application\Provider\Service\ProviderModelSyncAppService;
use App\Domain\Provider\Event\ProviderConfigCreatedEvent;
use App\Domain\Provider\Event\ProviderConfigUpdatedEvent;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 同步模型到Official服务商监听器.
 * 监听服务商配置创建/更新事件，从外部API拉取模型并同步到Official服务商.
 */
#[AsyncListener]
#[Listener]
class SyncModelsToOfficialListener implements ListenerInterface
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
        ];
    }

    public function process(object $event): void
    {
        try {
            $syncService = $this->container->get(ProviderModelSyncAppService::class);

            match (true) {
                $event instanceof ProviderConfigCreatedEvent => $this->handleProviderConfig($event, $syncService, 'created'),
                $event instanceof ProviderConfigUpdatedEvent => $this->handleProviderConfig($event, $syncService, 'updated'),
                default => null,
            };
        } catch (Throwable $e) {
            $this->logger->error('从外部API同步模型失败', [
                'event' => get_class($event),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 处理服务商配置创建或更新事件.
     * 如果是Official服务商且是官方组织，则从外部API拉取模型并同步.
     */
    private function handleProviderConfig(
        ProviderConfigCreatedEvent|ProviderConfigUpdatedEvent $event,
        ProviderModelSyncAppService $syncService,
        string $action
    ): void {
        $this->logger->info("收到服务商配置{$action}事件", [
            'config_id' => $event->providerConfigEntity->getId(),
            'organization_code' => $event->organizationCode,
            'action' => $action,
        ]);

        $syncService->syncModelsFromExternalApi(
            $event->providerConfigEntity,
            $event->organizationCode
        );
    }
}
