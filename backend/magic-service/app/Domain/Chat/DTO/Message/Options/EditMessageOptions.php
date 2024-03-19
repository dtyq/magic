<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Options;

use App\Domain\Chat\Entity\AbstractEntity;

class EditMessageOptions extends AbstractEntity
{
    // 被编辑的消息id，用于关联消息的多个版本
    protected string $magicMessageId;

    // 版本号id，发送方不用填写，服务端自动生成
    protected ?string $messageVersionId;

    public function __construct(?array $data = [])
    {
        parent::__construct($data);
    }

    public function getMagicMessageId(): ?string
    {
        return $this->magicMessageId ?? null;
    }

    public function setMagicMessageId(?string $magicMessageId): static
    {
        isset($magicMessageId) && $this->magicMessageId = $magicMessageId;
        return $this;
    }

    public function getMessageVersionId(): ?string
    {
        return $this->messageVersionId ?? null;
    }

    public function setMessageVersionId(?string $messageVersionId): static
    {
        $this->messageVersionId = $messageVersionId;
        return $this;
    }
}
