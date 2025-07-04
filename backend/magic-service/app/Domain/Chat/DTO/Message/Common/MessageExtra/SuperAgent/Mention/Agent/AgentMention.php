<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Agent;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\AbstractMention;

final class AgentMention extends AbstractMention
{
    public function getTextStruct(): string
    {
        /** @var AgentData $data */
        $data = $this->getAttrs()->getData();
        return $data instanceof AgentData ? (string) ($data->getAgentName() ?? '') : '';
    }
}
