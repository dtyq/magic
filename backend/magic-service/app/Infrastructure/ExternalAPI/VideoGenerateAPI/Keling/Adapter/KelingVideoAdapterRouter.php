<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use RuntimeException;

readonly class KelingVideoAdapterRouter implements VideoGenerationProviderAdapterInterface
{
    public function __construct(
        private KelingOmniVideoAdapter $kelingOmniVideoAdapter,
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

    private function resolveOperationAdapter(VideoQueueOperationEntity $operation): VideoGenerationProviderAdapterInterface
    {
        $adapter = $this->resolveAdapter($operation->getModelVersion(), $operation->getModel());
        if ($adapter !== null) {
            return $adapter;
        }

        throw new RuntimeException(sprintf(
            'unsupported Keling video model: %s (%s)',
            $operation->getModel(),
            $operation->getModelVersion(),
        ));
    }

    private function resolveAdapter(string $modelVersion, string $modelId): ?VideoGenerationProviderAdapterInterface
    {
        foreach ($this->adapters() as $adapter) {
            if (! $adapter instanceof VideoGenerationProviderAdapterInterface) {
                continue;
            }

            if ($adapter->supportsModel($modelVersion, $modelId)) {
                return $adapter;
            }
        }

        return null;
    }

    /**
     * @return array<int, VideoGenerationProviderAdapterInterface>
     */
    private function adapters(): array
    {
        return [
            $this->kelingOmniVideoAdapter,
        ];
    }
}
