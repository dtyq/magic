<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Mcp;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;

final class McpMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        /** @var McpData $data */
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof McpData) {
            return '';
        }

        return $data->getName() ?? '';
    }

    public function getMentionJsonStruct(): array
    {
        /** @var McpData $data */
        $data = $this->getAttrs()?->getData();
        if (! $data instanceof McpData) {
            return [];
        }

        return [
            'type' => MentionType::MCP->value,
            'id' => $data->getId(),
            'name' => $data->getName(),
            'icon' => $data->getIcon(),
        ];
    }
}
