<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use RuntimeException;

readonly class DashScopeVideoAdapterRouter implements VideoGenerationConnectivityTestableInterface
{
    public function __construct(
        private Wan30VideoAdapter $wan30VideoAdapter,
    ) {
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->resolveAdapter($modelVersion, $modelId) !== null;
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        return $this->resolveAdapter($modelVersion, $modelId)?->resolveGenerationConfig($modelVersion, $modelId);
    }

    public function resolveHasAudioOutput(string $modelVersion, string $modelId, array $request): bool
    {
        return $this->resolveAdapter($modelVersion, $modelId)?->resolveHasAudioOutput($modelVersion, $modelId, $request) ?? false;
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        return $this->resolveOperationAdapter($operation)->buildProviderPayload($operation);
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        return $this->resolveOperationAdapter($operation)->submit($operation, $config);
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        return $this->resolveOperationAdapter($operation)->query($operation, $config, $providerTaskId);
    }

    public function testConnection(QueueExecutorConfig $config, string $modelVersion): bool
    {
        $adapter = $this->resolveAdapter($modelVersion, '');
        if ($adapter instanceof VideoGenerationConnectivityTestableInterface) {
            return $adapter->testConnection($config, $modelVersion);
        }

        throw new RuntimeException(sprintf('unsupported DashScope video model: %s', $modelVersion));
    }

    private function resolveOperationAdapter(VideoQueueOperationEntity $operation): VideoGenerationProviderAdapterInterface
    {
        $adapter = $this->resolveAdapter($operation->getModelVersion(), $operation->getModel());
        if ($adapter !== null) {
            return $adapter;
        }

        throw new RuntimeException(sprintf(
            'unsupported DashScope video model: %s (%s)',
            $operation->getModel(),
            $operation->getModelVersion(),
        ));
    }

    private function resolveAdapter(string $modelVersion, string $modelId): ?VideoGenerationProviderAdapterInterface
    {
        return $this->wan30VideoAdapter->supportsModel($modelVersion, $modelId)
            ? $this->wan30VideoAdapter
            : null;
    }
}
