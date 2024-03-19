<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO;

class MagicFlowParamCallRequestDTO extends AbstractFlowDTO
{
    public string $conversationId = '';

    public string $flowCode;

    public array $params = [];

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(?string $conversationId): void
    {
        $this->conversationId = $conversationId ?? '';
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function setFlowCode(?string $flowCode): void
    {
        $this->flowCode = $flowCode ?? '';
    }

    public function getParams(): array
    {
        return $this->params;
    }

    public function setParams(?array $params): void
    {
        $this->params = $params ?? [];
    }
}
