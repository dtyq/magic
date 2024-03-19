<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\SupperMagicMCP;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;

interface SupperMagicAgentSkillInterface
{
    /**
     * Append the agent's skill list into taskContext dynamic_config['skill']['available'].
     * The agent code is resolved from task context (topic_pattern / agentMode).
     */
    public function appendSkillDynamicConfig(DataIsolation $dataIsolation, TaskContext $taskContext): void;
}
