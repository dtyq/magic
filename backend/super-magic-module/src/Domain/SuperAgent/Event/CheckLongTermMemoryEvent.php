<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use App\Domain\Chat\DTO\Agent\SenderExtraDTO;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\Core\AbstractEvent;
use Hyperf\Codec\Json;

/**
 * 检查是否需要长期记忆事件.
 */
class CheckLongTermMemoryEvent extends AbstractEvent
{
    public function __construct(
        public AccountEntity $agentAccountEntity,
        public MagicUserEntity $agentUserEntity,
        public AccountEntity $senderAccountEntity,
        public MagicUserEntity $senderUserEntity,
        public MagicSeqEntity $seqEntity,
        public ?MagicMessageEntity $messageEntity,
        public SenderExtraDTO $senderExtraDTO,
    ) {
    }

    public function getOrganizationCode(): string
    {
        return $this->senderUserEntity->getOrganizationCode();
    }

    public function getUserId(): string
    {
        return $this->senderUserEntity->getUserId();
    }

    public function getAgentUserId(): string
    {
        return $this->agentUserEntity->getUserId();
    }

    public function getConversationId(): string
    {
        return $this->seqEntity->getConversationId() ?? '';
    }

    public function getChatTopicId(): string
    {
        return $this->seqEntity->getExtra()?->getTopicId() ?? '';
    }

    public function getPrompt(): string
    {
        $messageStruct = $this->messageEntity?->getContent();
        if ($messageStruct instanceof TextContentInterface) {
            return $messageStruct->getTextContent();
        }
        return '';
    }

    public function getAttachments(): string
    {
        $attachments = $this->messageEntity?->getContent()?->getAttachments() ?? [];
        return ! empty($attachments) ? Json::encode($attachments) : '';
    }

    public function getInstructions(): array
    {
        return $this->messageEntity?->getContent()?->getInstructs() ?? [];
    }

    public function getMentions(): ?string
    {
        // 简化实现，避免复杂的类型检查
        return null;
    }

    public function getRawContent(): ?string
    {
        // 由于原始内容的构建需要复杂的逻辑，这里返回基本信息
        return Json::encode([
            'seq_id' => $this->seqEntity->getSeqId(),
            'message_id' => $this->seqEntity->getMessageId(),
            'conversation_id' => $this->seqEntity->getConversationId(),
        ]);
    }

    /**
     * 获取事件ID（使用seq_id作为事件的唯一标识）.
     */
    public function getEventId(): string
    {
        return $this->seqEntity->getSeqId();
    }

    /**
     * 转换为数组格式.
     *
     * @return array 事件数据数组
     */
    public function toArray(): array
    {
        return [
            'seq_id' => $this->seqEntity->getSeqId(),
            'organization_code' => $this->getOrganizationCode(),
            'user_id' => $this->getUserId(),
            'agent_user_id' => $this->getAgentUserId(),
            'conversation_id' => $this->getConversationId(),
            'chat_topic_id' => $this->getChatTopicId(),
            'prompt' => $this->getPrompt(),
            'attachments' => $this->getAttachments(),
            'instructions' => $this->getInstructions(),
            'mentions' => $this->getMentions(),
            'raw_content' => $this->getRawContent(),
        ];
    }
}
