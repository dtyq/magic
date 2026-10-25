<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Transport;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeVideoClient;

readonly class ApiKeyDashScopeTransport implements DashScopeTransportInterface
{
    public function __construct(
        private DashScopeVideoClient $client,
    ) {
    }

    public function submitVideo(QueueExecutorConfig $config, array $payload, array $logContext = []): array
    {
        return $this->client->post(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $this->buildVideoSynthesisPath(),
            $payload,
            $logContext,
            $config->getExtraString('proxy_url'),
        );
    }

    public function queryTask(QueueExecutorConfig $config, string $taskId, array $logContext = []): array
    {
        return $this->client->get(
            $config->getBaseUrl(),
            $config->getApiKey(),
            '/tasks/' . rawurlencode($taskId),
            $logContext,
            $config->getExtraString('proxy_url'),
        );
    }

    private function buildVideoSynthesisPath(): string
    {
        return '/services/aigc/video-generation/video-synthesis';
    }
}
