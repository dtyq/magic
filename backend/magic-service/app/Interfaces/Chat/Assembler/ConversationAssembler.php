<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Assembler;

use App\Domain\Chat\Entity\MagicConversationEntity;

class ConversationAssembler
{
    public static function getConversationEntity(array $conversationInfo): MagicConversationEntity
    {
        return new MagicConversationEntity($conversationInfo);
    }

    /**
     * @return MagicConversationEntity[]
     */
    public static function getConversationEntities(array $conversationInfos): array
    {
        $conversationEntities = [];
        foreach ($conversationInfos as $conversationInfo) {
            $conversationEntities[] = self::getConversationEntity($conversationInfo);
        }
        return $conversationEntities;
    }

    public static function getConversationChatCompletions(array $requestData, string $completions): array
    {
        return [
            'choices' => [
                [
                    'message' => [
                        'role' => 'assistant',
                        'content' => $completions,
                    ],
                ],
            ],
            'request_info' => $requestData,
        ];
    }
}
