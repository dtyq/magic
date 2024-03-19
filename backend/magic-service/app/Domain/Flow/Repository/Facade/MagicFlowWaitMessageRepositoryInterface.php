<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Facade;

use App\Domain\Flow\Entity\MagicFlowWaitMessageEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;

interface MagicFlowWaitMessageRepositoryInterface
{
    public function save(MagicFlowWaitMessageEntity $waitMessageEntity): MagicFlowWaitMessageEntity;

    public function find(FlowDataIsolation $dataIsolation, int $id): ?MagicFlowWaitMessageEntity;

    public function handled(FlowDataIsolation $dataIsolation, int $id): void;

    /**
     * @return MagicFlowWaitMessageEntity[]
     */
    public function listByUnhandledConversationId(FlowDataIsolation $dataIsolation, string $conversationId): array;
}
