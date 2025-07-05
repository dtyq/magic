<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Mcp;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;

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
}
