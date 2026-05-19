<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

enum ModelListType: string
{
    case CHAT = 'chat';
    case EMBEDDING = 'embedding';
    case IMAGE = 'image';
    case VIDEO = 'video';
    case ALL = 'all';

    public static function fromRequest(?string $type): self
    {
        $normalized = strtolower(trim((string) $type));
        return match ($normalized) {
            self::CHAT->value => self::CHAT,
            self::EMBEDDING->value => self::EMBEDDING,
            self::IMAGE->value => self::IMAGE,
            self::VIDEO->value => self::VIDEO,
            default => self::ALL,
        };
    }
}
