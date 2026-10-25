<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Contract\QueueOperationExecutorInterface;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Repository\QueueExecutorConfigRepositoryInterface;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;

readonly class QueueOperationExecutionDomainService
{
    public function __construct(
        private QueueExecutorConfigRepositoryInterface $queueExecutorConfigRepository,
        private QueueOperationExecutorInterface $queueOperationExecutor,
    ) {
    }

    public function getConfig(VideoQueueOperationEntity $operation): QueueExecutorConfig
    {
        return $this->queueExecutorConfigRepository->getConfig(
            $operation->getProviderModelId(),
            $operation->getOrganizationCode(),
        );
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        di(MagicClawRuntimePolicyDomainService::class)->assertModelInvocation(
            ModelGatewayDataIsolation::create($operation->getOrganizationCode(), $operation->getUserId()),
            ['magic_topic_id' => $operation->getTopicId(), 'magic_task_id' => $operation->getTaskId(), 'source_id' => $operation->getSourceId()],
        );
        return $this->queueOperationExecutor->submit($operation, $config);
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        return $this->queueOperationExecutor->query($operation, $config, $providerTaskId);
    }
}
