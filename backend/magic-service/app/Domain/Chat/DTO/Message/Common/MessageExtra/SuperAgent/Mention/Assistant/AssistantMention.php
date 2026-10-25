<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Assistant;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class AssistantMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof AssistantData) {
            return '';
        }

        $assistantId = $data->getAssistantId() ?? '';
        $assistantName = $data->getAssistantName() ?? $assistantId;
        if ($assistantId === '' || $assistantName === '') {
            return '';
        }

        $label = str_replace(['\\', '[', ']'], ['\\\\', '\[', '\]'], $assistantName);
        return sprintf('[%s](assistant://%s)', $label, rawurlencode($assistantId));
    }

    public function getMentionJsonStruct(): array
    {
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof AssistantData) {
            return [];
        }

        return [
            'type' => MentionType::ASSISTANT->value,
            'assistant_id' => $data->getAssistantId(),
            'assistant_name' => $data->getAssistantName(),
            'assistant_description' => $data->getAssistantDescription(),
        ];
    }
}
