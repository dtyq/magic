<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Agent;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class AgentMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        /** @var AgentData $data */
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof AgentData) {
            return '';
        }

        return $data->getAgentName() ?? '';
    }

    public function getMentionJsonStruct(): array
    {
        /** @var AgentData $data */
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof AgentData) {
            return [];
        }

        return [
            'type' => MentionType::AGENT->value,
            'agent_id' => $data->getAgentId(),
            'agent_name' => $data->getAgentName(),
            'agent_description' => $data->getAgentDescription(),
        ];
    }
}
