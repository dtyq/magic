<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Event\Subscribe;

use App\Application\Provider\SyncModel\SyncModelToOfficialProvider;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Event\ProviderConfigCreatedEvent;
use App\Domain\Provider\Event\ProviderConfigUpdatedEvent;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 服务商模型同步监听器，根据服务商编码分派对应的同步服务。
 */
#[AsyncListener]
#[Listener]
final class SyncModelsToProviderListener implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly SyncModelToOfficialProvider $providerSyncService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('ProviderModelSync');
    }

    public function listen(): array
    {
        return [ProviderConfigCreatedEvent::class, ProviderConfigUpdatedEvent::class];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ProviderConfigCreatedEvent && ! $event instanceof ProviderConfigUpdatedEvent) {
            return;
        }

        $config = $event->providerConfigEntity;
        $action = $event instanceof ProviderConfigCreatedEvent ? 'created' : 'updated';

        try {
            match ($config->getProviderCode()) {
                ProviderCode::Official => $this->providerSyncService->syncModelsFromExternalApi(
                    $config,
                    $event->language,
                    $event->organizationCode,
                ),
                default => null,
            };
        } catch (Throwable $throwable) {
            $this->logger->error('服务商模型同步失败', [
                'config_id' => $config->getId(),
                'provider_code' => $config->getProviderCode()?->value,
                'action' => $action,
                'error' => $throwable->getMessage(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
            ]);
        }
    }
}
