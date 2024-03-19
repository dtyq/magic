<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowMultiModalLogEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Repository\Facade\MagicFlowMultiModalLogRepositoryInterface;

class MagicFlowMultiModalLogDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowMultiModalLogRepositoryInterface $magicFlowMultiModalLogRepository,
    ) {
    }

    /**
     * 创建多模态日志记录.
     */
    public function create(FlowDataIsolation $dataIsolation, MagicFlowMultiModalLogEntity $entity): MagicFlowMultiModalLogEntity
    {
        $entity->prepareForCreation();
        return $this->magicFlowMultiModalLogRepository->create($dataIsolation, $entity);
    }

    /**
     * 根据ID获取多模态日志记录.
     */
    public function getById(FlowDataIsolation $dataIsolation, int $id): ?MagicFlowMultiModalLogEntity
    {
        return $this->magicFlowMultiModalLogRepository->getById($dataIsolation, $id);
    }

    /**
     * 根据消息ID获取多模态日志记录.
     */
    public function getByMessageId(FlowDataIsolation $dataIsolation, string $messageId): ?MagicFlowMultiModalLogEntity
    {
        return $this->magicFlowMultiModalLogRepository->getByMessageId($dataIsolation, $messageId);
    }

    /**
     * 批量获取多个消息ID对应的多模态日志记录.
     *
     * @param array<string> $messageIds
     * @return array<MagicFlowMultiModalLogEntity>
     */
    public function getByMessageIds(FlowDataIsolation $dataIsolation, array $messageIds, bool $keyByMessageId = false): array
    {
        return $this->magicFlowMultiModalLogRepository->getByMessageIds($dataIsolation, $messageIds, $keyByMessageId);
    }
}
