<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Flow;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Infrastructure\Core\Dag\VertexResult;

interface NodeRunnerInterface
{
    public function execute(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults = []): void;
}
