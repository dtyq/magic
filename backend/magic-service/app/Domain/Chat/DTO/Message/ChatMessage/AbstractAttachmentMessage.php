<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\ChatFileInterface;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\ChatAttachment;

abstract class AbstractAttachmentMessage extends AbstractChatMessageStruct implements ChatFileInterface
{
    /**
     * @var null|ChatAttachment[]
     */
    protected ?array $attachments = null;

    /**
     * @return null|ChatAttachment[]
     */
    public function getAttachments(): ?array
    {
        return $this->attachments;
    }

    public function setAttachments(?array $attachments): void
    {
        $chatAttachment = [];
        // 初始化附件
        if (! empty($attachments)) {
            foreach ($attachments as $attachment) {
                if ($attachment instanceof ChatAttachment) {
                    $chatAttachment[] = $attachment;
                } else {
                    $chatAttachment[] = new ChatAttachment($attachment);
                }
            }
        }
        $this->attachments = $chatAttachment ?: null;
    }

    public function getAttachmentIds(): array
    {
        if (empty($this->getAttachments())) {
            return [];
        }
        $attachmentIds = [];
        foreach ($this->attachments as $attachment) {
            $attachmentIds[] = $attachment->getFileId();
        }
        return $attachmentIds;
    }

    public function getFileIds(): array
    {
        return $this->getAttachmentIds();
    }
}
