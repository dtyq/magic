<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\AIImage\Request;

use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\Attachment\Attachment;
use App\Domain\Chat\DTO\Message\ChatFileInterface;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\Entity\ValueObject\AIImage\AIImageGenerateParamsVO;
use Exception;

/**
 * AI文生图chat请求参数.
 */
class MagicChatAIImageReqDTO
{
    public MessageInterface $userMessage;

    public string $conversationId;

    public string $topicId = ''; // 话题 id，可以为空

    public string $appMessageId;

    public string $language = 'zh_CN';

    public ?string $requestId = null;

    public AIImageGenerateParamsVO $params;

    public ?array $referenceImageIds = null;

    public ?string $referText = null;

    /**
     * @return AbstractAttachment[]
     */
    private array $attachments = [];

    private string $referMessageId = '';

    public function __construct()
    {
        $this->params = new AIImageGenerateParamsVO();
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): self
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): self
    {
        $this->conversationId = $conversationId;
        return $this;
    }

    public function getUserMessage(): MessageInterface
    {
        return $this->userMessage;
    }

    public function setUserMessage(MessageInterface $userMessage): self
    {
        $this->userMessage = $userMessage;
        if ($userMessage instanceof TextMessage) {
            $this->params->setUserPrompt($userMessage->getContent());
        } else {
            throw new Exception('不支持的消息类型');
        }
        /* @phpstan-ignore-next-line */
        if ($userMessage instanceof ChatFileInterface) {
            $this->setReferenceImageIds($userMessage->getFileIds());
        }

        return $this;
    }

    public function getAppMessageId(): string
    {
        return $this->appMessageId;
    }

    public function setAppMessageId(string $appMessageId): MagicChatAIImageReqDTO
    {
        $this->appMessageId = $appMessageId;
        return $this;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function setLanguage(string $language): MagicChatAIImageReqDTO
    {
        $this->language = $language;
        return $this;
    }

    public function getRequestId(): ?string
    {
        return $this->requestId;
    }

    public function setRequestId(?string $requestId): MagicChatAIImageReqDTO
    {
        $this->requestId = $requestId;
        return $this;
    }

    public function getParams(): AIImageGenerateParamsVO
    {
        return $this->params;
    }

    public function setParams(AIImageGenerateParamsVO $params): MagicChatAIImageReqDTO
    {
        $this->params = $params;
        return $this;
    }

    public function getReferenceImageIds(): ?array
    {
        return $this->referenceImageIds;
    }

    public function setReferenceImageIds(?array $referenceImageIds): MagicChatAIImageReqDTO
    {
        $this->referenceImageIds = $referenceImageIds;
        return $this;
    }

    /**
     * @return AbstractAttachment[]
     */
    public function getAttachments(): array
    {
        return $this->attachments;
    }

    /**
     * @param AbstractAttachment[] $attachments
     */
    public function setAttachments(array $attachments): MagicChatAIImageReqDTO
    {
        $this->attachments = $attachments;
        return $this;
    }

    /**
     * @param array<Attachment> $attachments
     * @return $this
     */
    public function fromAttachments(
        array $attachments
    ): MagicChatAIImageReqDTO {
        $referenceImageIds = array_filter(array_map(fn ($attachment) => $attachment->getChatFileId(), $attachments));
        $this->referenceImageIds = array_merge($referenceImageIds, $this->referenceImageIds ?? []);
        return $this;
    }

    public function getReferMessageId(): string
    {
        return $this->referMessageId;
    }

    public function setReferMessageId(string $referMessageId): MagicChatAIImageReqDTO
    {
        $this->referMessageId = $referMessageId;
        return $this;
    }

    public function getReferText(): ?string
    {
        return $this->referText;
    }

    public function setReferText(?string $referText): MagicChatAIImageReqDTO
    {
        $this->referText = $referText;
        return $this;
    }
}
