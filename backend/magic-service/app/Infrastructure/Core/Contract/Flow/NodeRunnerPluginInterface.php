<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Flow;

use Hyperf\Odin\Mcp\McpServerConfig;

interface NodeRunnerPluginInterface
{
    public function getAppendSystemPrompt(): ?string;

    /**
     * @return array<BuiltInToolInterface>
     */
    public function getTools(): array;

    /**
     * @return array<string, McpServerConfig>
     */
    public function getMcpServerConfigs(): array;
}
