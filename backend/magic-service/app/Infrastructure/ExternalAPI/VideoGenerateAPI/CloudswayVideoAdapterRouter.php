<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use RuntimeException;

readonly class CloudswayVideoAdapterRouter implements VideoGenerationProviderAdapterInterface
{
    /**
     * @var list<VideoGenerationProviderAdapterInterface>
     */
    private array $adapters;

    public function __construct(
        private CloudswayVeoVideoAdapter $cloudswayVeoVideoAdapter,
        private CloudswaySeedanceVideoAdapter $cloudswaySeedanceVideoAdapter,
        private CloudswayKelingVideoAdapter $cloudswayKelingVideoAdapter,
    ) {
        $this->adapters = [
            $this->cloudswayVeoVideoAdapter,
            $this->cloudswaySeedanceVideoAdapter,
            $this->cloudswayKelingVideoAdapter,
        ];
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->findAdapter($modelVersion, $modelId) !== null;
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        return $this->findAdapter($modelVersion, $modelId)?->resolveGenerationConfig($modelVersion, $modelId);
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
        $adapter = $this->findAdapter($operation->getModelVersion(), $operation->getModel());
        if ($adapter !== null) {
            return $adapter;
        }

        throw new RuntimeException(sprintf(
            'unsupported Cloudsway video model: %s (%s)',
            $operation->getModel(),
            $operation->getModelVersion(),
        ));
    }

    private function findAdapter(string $modelVersion, string $modelId): ?VideoGenerationProviderAdapterInterface
    {
        foreach ($this->adapters as $adapter) {
            if ($adapter->supportsModel($modelVersion, $modelId)) {
                return $adapter;
            }
        }

        return null;
    }
}
