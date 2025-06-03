<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Facade\HttpTransportHandler;

use App\Application\MCP\Service\MCPServerStreamableAppService;
use App\Domain\Authentication\Entity\ApiKeyProviderEntity;
use Dtyq\PhpMcp\Server\Transports\Http\Event\HttpTransportAuthenticatedEvent;
use Dtyq\PhpMcp\Shared\Exceptions\AuthenticationError;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;
use Qbhy\HyperfAuth\Authenticatable;

#[Listener]
class HttpTransportInitTransportMetadataListener implements ListenerInterface
{
    public function __construct(
        protected ContainerInterface $container,
    ) {
    }

    public function listen(): array
    {
        return [
            HttpTransportAuthenticatedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof HttpTransportAuthenticatedEvent) {
            return;
        }

        $transportMetadata = $event->getTransportMetadata();
        $authInfo = $event->getAuthInfo();

        $authorization = $authInfo->getMetadata('authorization');
        if (! $authorization instanceof Authenticatable) {
            throw new AuthenticationError('authorization metadata is required');
        }
        $apiKeyProvider = $authInfo->getMetadata('api_key_provider');
        if (! $apiKeyProvider instanceof ApiKeyProviderEntity) {
            throw new AuthenticationError('api_key_provider metadata is required');
        }

        $tools = $this->container->get(MCPServerStreamableAppService::class)->getTools($authorization, $apiKeyProvider->getRelCode());
        foreach ($tools as $tool) {
            $transportMetadata->getToolManager()->register($tool);
        }
    }
}
