<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Cache;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Cache\CacheScope;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

abstract class AbstractCacheNodeRunner extends NodeRunner
{
    public function getCachePrefix(CacheScope $cacheScope, ExecutionData $executionData): string
    {
        $prefix = match ($cacheScope) {
            CacheScope::Topic => $executionData->getConversationId() . '_' . $executionData->getTopicId(),
            CacheScope::User => $executionData->getOperator()->getUid(),
            CacheScope::Agent => $executionData->getAgentId(),
            /* @phpstan-ignore-next-line */
            default => ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_scope.invalid'),
        };
        return $cacheScope->value . '_' . $prefix;
    }
}
