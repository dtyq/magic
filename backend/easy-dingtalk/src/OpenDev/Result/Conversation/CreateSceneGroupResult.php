<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\Conversation;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidResultException;
use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class CreateSceneGroupResult extends AbstractResult
{
    private string $openConversationId;

    private string $chatId;

    public function buildByRawData(array $rawData): void
    {
        if (empty($rawData['open_conversation_id'])) {
            throw new InvalidResultException('open_conversation_id 不能为空');
        }
        if (empty($rawData['chat_id'])) {
            throw new InvalidResultException('chat_id 不能为空');
        }

        $this->openConversationId = $rawData['open_conversation_id'];
        $this->chatId = $rawData['chat_id'];
    }

    public function getOpenConversationId(): string
    {
        return $this->openConversationId;
    }

    public function setOpenConversationId(string $openConversationId): self
    {
        $this->openConversationId = $openConversationId;
        return $this;
    }

    public function getChatId(): string
    {
        return $this->chatId;
    }

    public function setChatId(string $chatId): self
    {
        $this->chatId = $chatId;
        return $this;
    }
}
