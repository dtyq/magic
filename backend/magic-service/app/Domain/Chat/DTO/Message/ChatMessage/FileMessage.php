<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

class FileMessage extends AbstractAttachmentMessage
{
    /**
     * 获取文件ID（返回第一个文件的ID）
     * 对于单文件消息（如语音、视频等）很有用.
     */
    public function getFileId(): ?string
    {
        $fileIds = $this->getFileIds();
        return ! empty($fileIds) ? $fileIds[0] : null;
    }

    /**
     * 获取第一个附件对象
     * 对于单附件消息（如语音、视频等）很有用.
     */
    public function getAttachment(): ?object
    {
        $attachments = $this->getAttachments();
        return ! empty($attachments) ? $attachments[0] : null;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::File;
    }
}
