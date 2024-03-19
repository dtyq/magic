<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Cache;

use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\Cache\StringCache\StringCacheInterface;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Cache\CacheSetNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Context\ApplicationContext;

#[FlowNodeDefine(
    type: NodeType::CacheSet->value,
    code: NodeType::CacheSet->name,
    name: '持久化数据库 / 数据存储',
    paramsConfig: CacheSetNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: false,
)]
class CacheSetNodeRunner extends AbstractCacheNodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var CacheSetNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $cacheKey = $paramsConfig->getCacheKey()->getValue()->getResult($executionData->getExpressionFieldData());
        if (empty($cacheKey)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_key.empty');
        }
        if (! is_string($cacheKey)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_key.string_only');
        }

        $cacheValue = $paramsConfig->getCacheValue()->getValue()->getResult($executionData->getExpressionFieldData());
        if (empty($cacheValue)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_value.empty');
        }
        if (! is_string($cacheValue)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_value.string_only');
        }

        $cacheTtl = $paramsConfig->getCacheTtl()->getValue()->getResult($executionData->getExpressionFieldData());
        if (empty($cacheTtl)) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_ttl.empty');
        }
        if (! is_numeric($cacheTtl) || $cacheTtl < -1) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteValidateFailed, 'flow.node.cache_ttl.int_only');
        }

        $cachePrefix = $this->getCachePrefix($paramsConfig->getCacheScope(), $executionData);

        $cacheDriver = ApplicationContext::getContainer()->get(StringCacheInterface::class);
        $cacheDriver->set($executionData->getDataIsolation(), $cachePrefix, $cacheKey, $cacheValue, (int) $cacheTtl);
    }
}
