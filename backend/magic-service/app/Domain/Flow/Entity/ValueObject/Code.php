<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

enum Code: string
{
    case MagicFlow = 'MAGIC-FLOW';
    case MagicFlowNode = 'MAGIC-FLOW-NODE';
    case MagicFlowDraft = 'MAGIC-FLOW-DRAFT';
    case MagicFlowVersion = 'MAGIC-FLOW-VERSION';
    case MagicFlowApiKey = 'MAGIC-FLOW-API-KEY';
    case Knowledge = 'KNOWLEDGE';
    case ApiKeySK = 'api-sk';
    case MagicFlowToolSet = 'TOOL-SET';

    public function gen(): string
    {
        return $this->value . '-' . str_replace('.', '-', uniqid('', true));
    }

    public function genUserTopic(string $conversationId, string $topic): string
    {
        return $this->value . '-' . $conversationId . '-' . $topic;
    }

    public function genUserConversation(string $conversationId): string
    {
        return $this->value . '-' . $conversationId;
    }
}
