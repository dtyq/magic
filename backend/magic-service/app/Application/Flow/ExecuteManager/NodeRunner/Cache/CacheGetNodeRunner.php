<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Cache;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache\StringCacheInterface;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Cache\CacheGetNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Context\ApplicationContext;

#[FlowNodeDefine(
    type: NodeType::CacheGet->value,
    code: NodeType::CacheGet->name,
    name: '持久化数据库 / 数据加载',
    paramsConfig: CacheGetNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: true,
)]
class CacheGetNodeRunner extends AbstractCacheNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var CacheGetNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $cacheKey = $paramsConfig->getCacheKey()->getValue()->getResult($executionData->getExpressionFieldData());
        if (empty($cacheKey)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_key.empty');
        }
        if (! is_string($cacheKey)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_key.string_only');
        }

        $cachePrefix = $this->getCachePrefix($paramsConfig->getCacheScope(), $executionData);

        $cacheDriver = ApplicationContext::getContainer()->get(StringCacheInterface::class);
        $cacheValue = $cacheDriver->get($executionData->getDataIsolation(), $cachePrefix, $cacheKey, '') ?: null;

        $result = [
            'cache_value' => $cacheValue,
        ];

        $vertexResult->setResult($result);
        $executionData->saveNodeContext($this->node->getNodeId(), $result);
    }
}
