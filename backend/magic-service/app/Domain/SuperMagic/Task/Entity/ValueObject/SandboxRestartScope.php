<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

/**
 * 重启范围.
 *
 * - All：清单里所有沙箱（普通话题 + Magic Claw 一视同仁）；
 * - MagicClaw：只处理属于 Magic Claw 项目的话题沙箱，且不碰共享的温池/孤儿 pod
 *   （它们不属于某只 Claw，删掉会影响所有用户）。
 */
enum SandboxRestartScope: string
{
    case All = 'all';
    case MagicClaw = 'magic-claw';

    public static function fromOption(string $value): ?self
    {
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return self::All;
        }
        return self::tryFrom($normalized);
    }

    public function deletesSharedPods(): bool
    {
        return $this === self::All;
    }
}
