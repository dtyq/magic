<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Tool;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;

final class ToolMention extends AbstractMention
{
    public function getTextStruct(): string
    {
        /** @var ToolData $data */
        $data = $this->getAttrs()->getData();
        return $data instanceof ToolData ? (string) ($data->getName() ?? '') : '';
    }
}
