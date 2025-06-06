<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\AgentPlugin;

use App\Infrastructure\Core\Contract\Flow\AgentPluginInterface;

abstract class AbstractAgentPlugin implements AgentPluginInterface
{
    public function getAppendSystemPrompt(): ?string
    {
        return null;
    }

    public function getTools(): array
    {
        return [];
    }

    public function getMcpServerConfigs(): array
    {
        return [];
    }
}
