<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

enum ConversationId: string
{
    case SingleDebugNode = 'SDN';
    case DebugFlow = 'DF';
    case ImChat = 'IC';
    case OpenChat = 'OC';
    case ApiParamCall = 'APC';
    case ApiKeyChat = 'AKC';
    case ThirdBotChat = 'TBC';
    case Routine = 'RT';

    public function gen(string $id): string
    {
        return $this->value . '-' . $id;
    }
}
