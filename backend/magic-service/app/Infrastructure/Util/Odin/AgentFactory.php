<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Odin;

use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Memory\MemoryManager;

class AgentFactory
{
    public static function create(
        ModelInterface $model,
        MemoryManager $memoryManager,
        array $tools = [],
        float $temperature = 0.5,
        array $businessParams = [],
    ): Agent {
        $agent = new Agent(
            model: $model,
            memory: $memoryManager,
            tools: $tools,
            temperature: $temperature,
            logger: di(LoggerFactory::class)->get('OdinAgent')
        );
        $agent->setBusinessParams($businessParams);
        return $agent;
    }
}
