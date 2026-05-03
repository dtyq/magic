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
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use RuntimeException;

readonly class KelingVideoAdapterRouter implements VideoGenerationProviderAdapterInterface
{
    public function __construct(
        private KelingOmniVideoAdapter $kelingOmniVideoAdapter,
        private ?KelingV3VideoAdapter $kelingV3VideoAdapter = null,
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
        $adapter = $this->resolveOperationAdapter($operation);
        // keling暂不支持有音频文件
        $this->assertInputCompatibility($operation, $adapter);

        return $adapter->buildProviderPayload($operation);
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
            $this->kelingV3VideoAdapter,
        ];
    }

    /**
     * keling暂不支持有音频文件.
     */
    private function assertInputCompatibility(
        VideoQueueOperationEntity $operation,
        VideoGenerationProviderAdapterInterface $adapter
    ): void {
        $inputs = is_array($operation->getRawRequest()['inputs'] ?? null) ? $operation->getRawRequest()['inputs'] : [];
        $referenceAudios = is_array($inputs['reference_audios'] ?? null) ? $inputs['reference_audios'] : [];
        if ($referenceAudios === []) {
            return;
        }

        if ($adapter instanceof KelingOmniVideoAdapter || $adapter instanceof KelingV3VideoAdapter) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.reference_audios is invalid');
        }
    }
}
