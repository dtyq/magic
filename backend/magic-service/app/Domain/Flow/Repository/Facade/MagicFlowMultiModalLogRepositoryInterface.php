<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowMultiModalLogEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;

interface MagicFlowMultiModalLogRepositoryInterface
{
    public function create(FlowDataIsolation $dataIsolation, MagicFlowMultiModalLogEntity $entity): MagicFlowMultiModalLogEntity;

    public function getById(FlowDataIsolation $dataIsolation, int $id): ?MagicFlowMultiModalLogEntity;

    public function getByMessageId(FlowDataIsolation $dataIsolation, string $messageId): ?MagicFlowMultiModalLogEntity;

    /**
     * 批量获取多个消息ID对应的多模态日志记录.
     *
     * @param array<string> $messageIds
     * @return array<MagicFlowMultiModalLogEntity>
     */
    public function getByMessageIds(FlowDataIsolation $dataIsolation, array $messageIds, bool $keyByMessageId = false): array;
}
