<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\ChatFileInterface;
use App\Domain\Chat\Entity\ValueObject\AIImage\AIImageCardResponseType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

/**
 * AI文生图的卡片消息.
 */
class AIImageCardMessage extends AbstractChatMessageStruct implements ChatFileInterface
{
    protected ?AIImageCardResponseType $type = null;

    protected ?array $items = null;

    protected ?string $text = null;

    protected ?string $referFileId = null;

    protected ?string $referText = null;

    protected ?string $errorMessage = null;

    protected ?string $radio = null;

    public function __construct(?array $messageStruct = null)
    {
        $type = $messageStruct['type'] ?? null;
        unset($messageStruct['type']);
        $this->setType($type);
        parent::__construct($messageStruct);
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
    }

    public function getType(): ?AIImageCardResponseType
    {
        return $this->type;
    }

    public function setType(null|AIImageCardResponseType|int $type): AIImageCardMessage
    {
        is_int($type) && $type = AIImageCardResponseType::from($type);
        $this->type = $type;
        return $this;
    }

    public function getItems(): ?array
    {
        return $this->items;
    }

    public function setItems(?array $items): AIImageCardMessage
    {
        $this->items = $items;
        return $this;
    }

    public function getText(): ?string
    {
        return $this->text;
    }

    public function setText(?string $text): AIImageCardMessage
    {
        $this->text = $text;
        return $this;
    }

    public function getReferFileId(): ?string
    {
        return $this->referFileId;
    }

    public function setReferFileId(?string $referFileId): AIImageCardMessage
    {
        $this->referFileId = $referFileId;
        return $this;
    }

    public function getFileIds(): array
    {
        $fileIds = [];
        foreach ($this->getItems() ?? [] as $item) {
            if (empty($item['file_id'])) {
                continue;
            }
            $fileIds[] = $item['file_id'];
        }
        ! empty($this->getReferFileId()) && $fileIds[] = $this->getReferFileId();
        return $fileIds;
    }

    public function getRadio(): ?string
    {
        return $this->radio;
    }

    public function setRadio(?string $radio): AIImageCardMessage
    {
        $this->radio = $radio;
        return $this;
    }

    public function getReferText(): ?string
    {
        return $this->referText;
    }

    public function setReferText(?string $referText): AIImageCardMessage
    {
        $this->referText = $referText;
        return $this;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::AIImageCard;
    }
}
