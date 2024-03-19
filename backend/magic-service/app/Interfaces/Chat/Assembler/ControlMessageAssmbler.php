<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;

class ControlMessageAssmbler
{
    /**
     * @param string[] $senderMessageIds
     */
    public static function getSeenMessageStruct(array $senderMessageIds)
    {
        $typeName = ControlMessageType::SeenMessages->getName();
        return [
            'type' => $typeName,
            $typeName => [
                'sender_message_ids' => $senderMessageIds,
            ],
        ];
    }
}
