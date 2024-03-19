<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\ImageConvertHigh\Request;

use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;

class MagicChatImageConvertHighReqDTO
{
    public MessageInterface $userMessage;

    public string $conversationId;

    public string $topicId = ''; // 话题 id，可以为空

    public string $appMessageId;

    public string $language = 'zh_CN';

    public ?string $requestId = null;

    public string $originImageUrl = '';

    public string $originImageId = '';

    public ?string $referText = null;

    public string $referMessageId = '';

    public ?string $radio = null;

    public ImageGenerateSourceEnum $sourceType;

    public string $sourceId;

    public function getReferText(): ?string
    {
        return $this->referText;
    }

    public function setReferText(?string $referText): MagicChatImageConvertHighReqDTO
    {
        $this->referText = $referText;
        return $this;
    }

    public function getReferMessageId(): ?string
    {
        return $this->referMessageId;
    }

    public function setReferMessageId(?string $referMessageId): MagicChatImageConvertHighReqDTO
    {
        $this->referMessageId = $referMessageId;
        return $this;
    }

    public function getOriginImageUrl(): string
    {
        return $this->originImageUrl;
    }

    public function setOriginImageUrl(string $originImageUrl): MagicChatImageConvertHighReqDTO
    {
        $this->originImageUrl = $originImageUrl;
        return $this;
    }

    public function getUserMessage(): MessageInterface
    {
        return $this->userMessage;
    }

    public function setUserMessage(MessageInterface $userMessage): MagicChatImageConvertHighReqDTO
    {
        $this->userMessage = $userMessage;
        return $this;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): MagicChatImageConvertHighReqDTO
    {
        $this->conversationId = $conversationId;
        return $this;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): MagicChatImageConvertHighReqDTO
    {
        $this->topicId = $topicId;
        return $this;
    }

    public function getAppMessageId(): string
    {
        return $this->appMessageId;
    }

    public function setAppMessageId(string $appMessageId): MagicChatImageConvertHighReqDTO
    {
        $this->appMessageId = $appMessageId;
        return $this;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function setLanguage(string $language): MagicChatImageConvertHighReqDTO
    {
        $this->language = $language;
        return $this;
    }

    public function getRequestId(): ?string
    {
        return $this->requestId;
    }

    public function setRequestId(?string $requestId): MagicChatImageConvertHighReqDTO
    {
        $this->requestId = $requestId;
        return $this;
    }

    public function getOriginImageId(): string
    {
        return $this->originImageId;
    }

    public function setOriginImageId(string $originImageId): MagicChatImageConvertHighReqDTO
    {
        $this->originImageId = $originImageId;
        return $this;
    }

    public function getRadio(): ?string
    {
        return $this->radio;
    }

    public function setRadio(?string $radio): MagicChatImageConvertHighReqDTO
    {
        $this->radio = $radio;
        return $this;
    }

    public function getSourceType(): ImageGenerateSourceEnum
    {
        return $this->sourceType;
    }

    public function setSourceType(ImageGenerateSourceEnum $sourceType): self
    {
        $this->sourceType = $sourceType;
        return $this;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function setSourceId(string $sourceId): self
    {
        $this->sourceId = $sourceId;
        return $this;
    }
}
