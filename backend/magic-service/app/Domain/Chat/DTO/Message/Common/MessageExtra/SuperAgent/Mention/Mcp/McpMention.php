<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Mcp;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;

final class McpMention extends AbstractMention
{
    public function getTextStruct(): string
    {
        /** @var McpData $data */
        $data = $this->getAttrs()->getData();
        return $data instanceof McpData ? (string) ($data->getName() ?? '') : '';
    }
}
