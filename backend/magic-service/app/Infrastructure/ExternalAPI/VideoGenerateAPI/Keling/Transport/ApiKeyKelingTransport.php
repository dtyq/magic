<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingVideoClient;

readonly class ApiKeyKelingTransport implements KelingTransportInterface
{
    public function __construct(
        private KelingVideoClient $client,
    ) {
    }

    public function submitOmniVideo(QueueExecutorConfig $config, array $payload, array $logContext = []): array
    {
        return $this->client->post(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $this->buildOmniVideoPath(),
            $payload,
            $logContext,
        );
    }

    public function queryOmniVideo(QueueExecutorConfig $config, string $taskId, array $logContext = []): array
    {
        return $this->client->get(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $this->buildOmniVideoPath() . '/' . rawurlencode($taskId),
            $logContext,
        );
    }

    public function submitV3Video(QueueExecutorConfig $config, array $payload, bool $hasImageInput, array $logContext = []): array
    {
        return $this->client->post(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $this->buildV3VideoPath($hasImageInput),
            $payload,
            $logContext,
        );
    }

    public function queryV3Video(QueueExecutorConfig $config, string $taskId, bool $hasImageInput, array $logContext = []): array
    {
        return $this->client->get(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $this->buildV3VideoPath($hasImageInput) . '/' . rawurlencode($taskId),
            $logContext,
        );
    }

    private function buildOmniVideoPath(): string
    {
        return '/kling/videos/omni-video';
    }

    private function buildV3VideoPath(bool $hasImageInput): string
    {
        return $hasImageInput ? '/kling/videos/image2video' : '/kling/videos/text2video';
    }
}
