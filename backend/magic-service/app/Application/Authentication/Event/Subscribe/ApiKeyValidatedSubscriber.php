<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Authentication\Event\Subscribe;

use App\Domain\Authentication\Entity\ValueObject\AuthenticationDataIsolation;
use App\Domain\Authentication\Event\ApiKeyValidatedEvent;
use App\Domain\Authentication\Service\ApiKeyProviderDomainService;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;

#[AsyncListener]
#[Listener]
readonly class ApiKeyValidatedSubscriber implements ListenerInterface
{
    public function __construct(private ContainerInterface $container)
    {
    }

    public function listen(): array
    {
        return [
            ApiKeyValidatedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ApiKeyValidatedEvent) {
            return;
        }

        $apiKeyProvider = $event->getApiKeyProvider();

        // 创建一个空的数据隔离对象
        $dataIsolation = AuthenticationDataIsolation::create($apiKeyProvider->getOrganizationCode())->disabled();

        // 通过领域服务更新最后使用时间
        $this->container->get(ApiKeyProviderDomainService::class)
            ->updateLastUsed($dataIsolation, $apiKeyProvider);
    }
}
