<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

final class GeneratedSuggestionType
{
    public const SUPER_MAGIC_TOPIC_FOLLOW_UP = 1;

    public static function label(int $type): string
    {
        return match ($type) {
            self::SUPER_MAGIC_TOPIC_FOLLOW_UP => 'super_magic_topic_followup',
            default => 'unknown',
        };
    }
}
