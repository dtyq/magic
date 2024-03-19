<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner;

use App\Domain\Flow\Entity\ValueObject\Node;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Contract\Flow\NodeRunnerInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class NodeRunnerFactory
{
    public static function make(Node $node): NodeRunnerInterface
    {
        $nodeRunnerClass = $node->getNodeDefine()->getRunner();
        if (! $nodeRunnerClass) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.executor.unsupported_node_type', ['node_type' => "{$node->getName()} {$node->getNodeVersion()}"]);
        }
        return \Hyperf\Support\make($nodeRunnerClass, [$node]);
    }
}
