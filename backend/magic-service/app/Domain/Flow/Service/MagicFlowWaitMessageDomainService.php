<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowWaitMessageEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Repository\Facade\MagicFlowWaitMessageRepositoryInterface;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class MagicFlowWaitMessageDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowWaitMessageRepositoryInterface $magicFlowWaitMessageRepository,
    ) {
    }

    public function save(FlowDataIsolation $dataIsolation, MagicFlowWaitMessageEntity $savingWaitMessageEntity): MagicFlowWaitMessageEntity
    {
        $savingWaitMessageEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingWaitMessageEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        if ($savingWaitMessageEntity->shouldCreate()) {
            $waitMessageEntity = clone $savingWaitMessageEntity;
            $waitMessageEntity->prepareForCreation();
        } else {
            // 暂时只支持创建
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'unsupported update');
        }

        return $this->magicFlowWaitMessageRepository->save($waitMessageEntity);
    }

    public function handled(FlowDataIsolation $dataIsolation, int $id): void
    {
        $this->magicFlowWaitMessageRepository->handled($dataIsolation, $id);
    }

    public function getLastWaitMessage(FlowDataIsolation $dataIsolation, string $conversationId, string $flowCode, string $flowVersion): ?MagicFlowWaitMessageEntity
    {
        // 应该不会很多，直接取所有
        $waitMessages = $this->listByUnhandledConversationId($dataIsolation, $conversationId);
        foreach ($waitMessages as $waitMessage) {
            // 如果超时
            $isTimeout = false;
            if (! empty($waitMessage->getTimeout())) {
                $isTimeout = $waitMessage->getTimeout() < time();
            }
            // 如果版本变更
            $isVersionChanged = $waitMessage->getFlowCode() !== $flowCode || $waitMessage->getFlowVersion() !== $flowVersion;
            if ($isTimeout || $isVersionChanged) {
                $this->handled($dataIsolation, $waitMessage->getId());
            } else {
                return $this->magicFlowWaitMessageRepository->find($dataIsolation, $waitMessage->getId());
            }
        }
        return null;
    }

    /**
     * @return MagicFlowWaitMessageEntity[]
     */
    public function listByUnhandledConversationId(FlowDataIsolation $dataIsolation, string $conversationId): array
    {
        return $this->magicFlowWaitMessageRepository->listByUnhandledConversationId($dataIsolation, $conversationId);
    }
}
