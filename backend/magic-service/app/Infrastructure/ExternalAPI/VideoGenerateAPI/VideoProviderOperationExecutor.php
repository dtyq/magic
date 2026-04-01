<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\QueueOperationExecutorInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use InvalidArgumentException;
use RuntimeException;

readonly class VideoProviderOperationExecutor implements QueueOperationExecutorInterface
{
    public function __construct(
        private VideoGenerateFactory $videoGenerateFactory,
    ) {
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $adapter = $this->resolveAdapter($operation, $config);
        $operation->setProviderPayload($adapter->buildProviderPayload($operation));

        return $adapter->submit($operation, $config);
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        return $this->resolveAdapter($operation, $config)->query($operation, $config, $providerTaskId);
    }

    private function resolveAdapter(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): VideoGenerationProviderAdapterInterface
    {
        $providerCode = ProviderCode::tryFrom($operation->getProviderCode());
        if (! $providerCode instanceof ProviderCode) {
            throw new RuntimeException(sprintf(
                'video generation adapter not found for model %s (provider: %s)',
                $operation->getModel(),
                $operation->getProviderCode(),
            ));
        }

        try {
            return $this->videoGenerateFactory->create(
                VideoGenerateProviderType::fromProviderCode($providerCode, $operation->getModelVersion())
            );
        } catch (InvalidArgumentException) {
            throw new RuntimeException(sprintf(
                'video generation adapter not found for model %s (provider: %s)',
                $operation->getModel(),
                $operation->getProviderCode(),
            ));
        }
    }
}
