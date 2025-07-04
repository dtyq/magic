<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Tool;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;

final class ToolMention extends AbstractMention
{
    public function getMentionTextStruct(): string
    {
        /** @var ToolData $data */
        $data = $this->getAttrs()->getData();
        if (! $data instanceof ToolData) {
            return '';
        }

        return (string) ($data->getName() ?? '');
    }
}
