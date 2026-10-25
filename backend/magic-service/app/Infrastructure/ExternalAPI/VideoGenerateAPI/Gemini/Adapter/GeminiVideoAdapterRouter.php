<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use RuntimeException;

readonly class GeminiVideoAdapterRouter implements VideoGenerationConnectivityTestableInterface
{
    public function __construct(private GeminiOmni1FlashVideoAdapter $geminiOmniVideoAdapter)
    {
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

        throw new RuntimeException(sprintf('unsupported Gemini video model: %s', $modelVersion));
    }

    private function resolveOperationAdapter(VideoQueueOperationEntity $operation): VideoGenerationProviderAdapterInterface
    {
        $modelVersion = trim($operation->getModelVersion()) !== '' ? $operation->getModelVersion() : $operation->getModel();
        $modelId = trim($operation->getProviderModelId());
        if ($modelVersion !== '' && ctype_digit($modelId)) {
            $modelId = '';
        }
        $adapter = $this->resolveAdapter($modelVersion, $modelId);
        if ($adapter === null) {
            throw new RuntimeException(sprintf('unsupported Gemini video model: %s (%s)', $operation->getModel(), $operation->getModelVersion()));
        }
        return $adapter;
    }

    private function resolveAdapter(string $modelVersion, string $modelId): ?VideoGenerationProviderAdapterInterface
    {
        return $this->geminiOmniVideoAdapter->supportsModel($modelVersion, $modelId) ? $this->geminiOmniVideoAdapter : null;
    }
}
