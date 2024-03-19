<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\Agent\Factory;

use App\Application\Chat\Event\Subscribe\Agent\Agents\AgentInterface;
use App\Application\Chat\Event\Subscribe\Agent\Agents\DefaultAgent;

class AgentFactory
{
    public static function make(string $aiCode): AgentInterface
    {
        // 暂无需要硬编码的助理，后续有可以复用该工厂逻辑创建硬编码助理
        /* @phpstan-ignore-next-line */
        return match ($aiCode) {
            default => di(DefaultAgent::class),
        };
    }
}
