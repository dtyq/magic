<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\DTO\Agent\SenderExtraDTO;
use App\Domain\Chat\DTO\MagicMessageDTO;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Event\Agent\UserCallAgentEvent;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Throwable;

/**
 * 临时消息相关.
 */
class MagicIntermediateDomainService extends AbstractDomainService
{
    // 超级麦吉的交互指令临时消息处理
    /**
     * @throws Throwable
     */
    public function handleSuperMagicInstructionMessage(
        MagicMessageDTO $messageDTO,
        DataIsolation $dataIsolation,
        MagicConversationEntity $userConversationEntity,
    ): void {
        try {
            // 1. 获取发送者（当前用户）信息
            $senderUserId = $dataIsolation->getCurrentUserId();
            if (empty($senderUserId)) {
                ExceptionBuilder::throw(ChatErrorCode::USER_NOT_FOUND);
            }

            $senderUserEntity = $this->magicUserRepository->getUserById($senderUserId);
            if (! $senderUserEntity) {
                ExceptionBuilder::throw(ChatErrorCode::USER_NOT_FOUND);
            }
            $senderAccountEntity = $this->magicAccountRepository->getAccountInfoByMagicId($senderUserEntity->getMagicId());

            if (! $senderAccountEntity) {
                ExceptionBuilder::throw(ChatErrorCode::USER_NOT_FOUND);
            }

            // 2. 获取超级麦吉（接收者）信息
            $agentUserId = $messageDTO->getReceiveId();
            $agentUserEntity = $this->magicUserRepository->getUserById($agentUserId);
            if (! $agentUserEntity) {
                ExceptionBuilder::throw(ChatErrorCode::USER_NOT_FOUND);
            }
            $agentAccountEntity = $this->magicAccountRepository->getAccountInfoByMagicId($agentUserEntity->getMagicId());

            if (! $agentAccountEntity) {
                ExceptionBuilder::throw(ChatErrorCode::AI_NOT_FOUND);
            }

            // 3. 获取 agent 的 conversationId
            $agentConversationEntity = $this->magicConversationRepository->getReceiveConversationBySenderConversationId(
                $userConversationEntity->getId()
            );

            if ($agentConversationEntity === null) {
                ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
            }

            $agentConversationId = $agentConversationEntity->getId();

            // 4. 创建序列实体 (临时消息不需要持久化序列)
            $seqEntity = new MagicSeqEntity();
            $seqEntity->setAppMessageId($messageDTO->getAppMessageId());
            $seqEntity->setConversationId($agentConversationId);
            $seqEntity->setObjectId($agentAccountEntity->getMagicId());
            $seqEntity->setContent($messageDTO->getContent());

            // 设置额外信息 (包括 topicId)
            $seqExtra = new SeqExtra();
            // 从 messageDTO 中获取 topicId
            $topicId = $messageDTO->getTopicId() ?? '';

            // 如果 topicId 不为空，验证话题是否属于当前用户
            if (empty($topicId)) {
                ExceptionBuilder::throw(ChatErrorCode::TOPIC_NOT_FOUND);
            }
            $this->validateTopicOwnership($topicId, $userConversationEntity->getId(), $dataIsolation);

            $seqExtra->setTopicId($topicId);
            $seqEntity->setExtra($seqExtra);

            // 5. 创建消息实体 (转换DTO为Entity，但不持久化)
            $messageEntity = new MagicMessageEntity();
            $messageEntity->setSenderId($messageDTO->getSenderId());
            $messageEntity->setSenderType($messageDTO->getSenderType());
            $messageEntity->setSenderOrganizationCode($messageDTO->getSenderOrganizationCode());
            $messageEntity->setReceiveId($messageDTO->getReceiveId());
            $messageEntity->setReceiveType($messageDTO->getReceiveType());
            $messageEntity->setReceiveOrganizationCode($messageDTO->getReceiveOrganizationCode());
            $messageEntity->setAppMessageId($messageDTO->getAppMessageId());
            $messageEntity->setContent($messageDTO->getContent());
            $messageEntity->setMessageType($messageDTO->getMessageType());
            $messageEntity->setSendTime($messageDTO->getSendTime());

            // 6. 创建发送者额外信息
            $senderExtraDTO = new SenderExtraDTO();
            // 临时消息可能不需要环境ID，使用默认值
            $senderExtraDTO->setMagicEnvId(null);

            // 7. 触发用户调用超级麦吉事件
            event_dispatch(new UserCallAgentEvent(
                $agentAccountEntity,
                $agentUserEntity,
                $senderAccountEntity,
                $senderUserEntity,
                $seqEntity,
                $messageEntity,
                $senderExtraDTO
            ));
        } catch (Throwable $e) {
            // 记录错误日志，但不阻断处理流程
            $this->logger?->error('HandleSuperMagicInstructionMessage failed', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'messageDTO' => $messageDTO->toArray(),
            ]);
            throw $e;
        }
    }

    /**
     * 验证话题是否属于当前用户.
     */
    private function validateTopicOwnership(string $topicId, string $conversationId, DataIsolation $dataIsolation): void
    {
        // 创建话题DTO
        $topicDTO = new MagicTopicEntity();
        $topicDTO->setTopicId($topicId);
        $topicDTO->setConversationId($conversationId);

        // 获取话题实体
        $topicEntity = $this->magicChatTopicRepository->getTopicEntity($topicDTO);
        if ($topicEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::TOPIC_NOT_FOUND);
        }

        // 验证话题所属的会话是否属于当前用户
        $this->checkAndGetSelfConversation($topicEntity->getConversationId(), $dataIsolation);
    }
}
