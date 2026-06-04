<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

readonly class DashScopeVideoAdapterRouter implements VideoGenerationProviderAdapterInterface
{
    public function __construct(
        private Wan27VideoAdapter $wan27VideoAdapter,
    ) {
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->wan27VideoAdapter->supportsModel($modelVersion, $modelId);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        return $this->wan27VideoAdapter->resolveGenerationConfig($modelVersion, $modelId);
    }

    public function resolveHasAudioOutput(string $modelVersion, string $modelId, array $request): bool
    {
        return $this->wan27VideoAdapter->resolveHasAudioOutput($modelVersion, $modelId, $request);
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        return $this->wan27VideoAdapter->buildProviderPayload($operation);
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        return $this->wan27VideoAdapter->submit($operation, $config);
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        return $this->wan27VideoAdapter->query($operation, $config, $providerTaskId);
    }
}
