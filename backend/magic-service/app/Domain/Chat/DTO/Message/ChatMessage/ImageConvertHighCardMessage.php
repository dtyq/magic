<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\ChatFileInterface;
use App\Domain\Chat\Entity\ValueObject\ImageConvertHigh\ImageConvertHighResponseType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

/**
 * AI文生图的卡片消息.
 */
class ImageConvertHighCardMessage extends AbstractChatMessageStruct implements ChatFileInterface
{
    protected ?ImageConvertHighResponseType $type = null;

    protected ?string $originFileId = null;

    protected ?string $newFileId = null;

    protected ?string $errorMessage = null;

    protected ?string $referText = null;

    protected ?string $radio = null;

    public function __construct(?array $messageStruct = null)
    {
        $type = $messageStruct['type'] ?? null;
        unset($messageStruct['type']);
        $this->setType($type);
        parent::__construct($messageStruct);
    }

    public function getType(): ?ImageConvertHighResponseType
    {
        return $this->type;
    }

    public function setType(null|ImageConvertHighResponseType|int $type): ImageConvertHighCardMessage
    {
        if (is_int($type)) {
            $type = ImageConvertHighResponseType::from($type);
        }
        $this->type = $type;
        return $this;
    }

    public function getOriginFileId(): ?string
    {
        return $this->originFileId;
    }

    public function setOriginFileId(?string $originFileId): ImageConvertHighCardMessage
    {
        $this->originFileId = $originFileId;
        return $this;
    }

    public function getNewFileId(): ?string
    {
        return $this->newFileId;
    }

    public function setNewFileId(?string $newFileId): ImageConvertHighCardMessage
    {
        $this->newFileId = $newFileId;
        return $this;
    }

    public function getFileIds(): array
    {
        return [$this->newFileId, $this->originFileId];
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): ImageConvertHighCardMessage
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    public function getReferText(): ?string
    {
        return $this->referText;
    }

    public function setReferText(?string $referText): ImageConvertHighCardMessage
    {
        $this->referText = $referText;
        return $this;
    }

    public function getRadio(): ?string
    {
        return $this->radio;
    }

    public function setRadio(?string $radio): ImageConvertHighCardMessage
    {
        $this->radio = $radio;
        return $this;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::ImageConvertHighCard;
    }
}
