<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use RuntimeException;

/**
 * 方舟 Seedance 视频模型按家族分发。
 *
 * 目前只接入 2.0 mini/fast、2.0、2.5 三个家族；模型标识未命中任何一个时直接报错，
 * 不再提供兜底能力，避免把不属于任何家族的模型按错误的能力档位提交给 provider。
 */
readonly class VolcengineArkVideoAdapterRouter implements VideoGenerationConnectivityTestableInterface
{
    /**
     * @var list<VideoGenerationProviderAdapterInterface>
     */
    private array $adapters;

    public function __construct(
        private Seedance20MiniFastVideoAdapter $seedance20MiniFastVideoAdapter,
        private Seedance20VideoAdapter $seedance20VideoAdapter,
        private Seedance25VideoAdapter $seedance25VideoAdapter,
    ) {
        $this->adapters = [
            $this->seedance20MiniFastVideoAdapter,
            $this->seedance20VideoAdapter,
            $this->seedance25VideoAdapter,
        ];
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

        throw new RuntimeException(sprintf('unsupported VolcengineArk video model: %s', $modelVersion));
    }

    private function resolveOperationAdapter(VideoQueueOperationEntity $operation): VideoGenerationProviderAdapterInterface
    {
        $adapter = $this->resolveAdapter($operation->getModelVersion(), $operation->getModel());
        if ($adapter !== null) {
            return $adapter;
        }

        throw new RuntimeException(sprintf(
            'unsupported VolcengineArk video model: %s (%s)',
            $operation->getModel(),
            $operation->getModelVersion(),
        ));
    }

    private function resolveAdapter(string $modelVersion, string $modelId): ?VideoGenerationProviderAdapterInterface
    {
        return array_find(
            $this->adapters,
            static fn (VideoGenerationProviderAdapterInterface $adapter): bool => $adapter->supportsModel($modelVersion, $modelId),
        );
    }
}
