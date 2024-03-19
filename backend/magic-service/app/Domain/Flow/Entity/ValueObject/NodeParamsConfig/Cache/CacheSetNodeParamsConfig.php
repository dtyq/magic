<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Cache;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class CacheSetNodeParamsConfig extends NodeParamsConfig
{
    private CacheScope $cacheScope;

    private Component $cacheKey;

    private Component $cacheValue;

    private Component $cacheTtl;

    public function getCacheScope(): CacheScope
    {
        return $this->cacheScope;
    }

    public function getCacheKey(): Component
    {
        return $this->cacheKey;
    }

    public function getCacheValue(): Component
    {
        return $this->cacheValue;
    }

    public function getCacheTtl(): Component
    {
        return $this->cacheTtl;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();

        $cacheScope = CacheScope::tryFrom($params['cache_scope'] ?? '');
        if (! $cacheScope) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'common.invalid', ['label' => 'cache_scope']);
        }
        $this->cacheScope = $cacheScope;

        $cacheKey = ComponentFactory::fastCreate($params['cache_key'] ?? []);
        if (! $cacheKey?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'cache_key']);
        }
        $this->cacheKey = $cacheKey;
        $this->cacheKey->getValue()->getExpressionValue()?->setIsStringTemplate(true);

        $cacheValue = ComponentFactory::fastCreate($params['cache_value'] ?? []);
        if (! $cacheValue?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'cache_value']);
        }
        $this->cacheValue = $cacheValue;
        $this->cacheValue->getValue()->getExpressionValue()?->setIsStringTemplate(true);

        $cacheTtl = ComponentFactory::fastCreate($params['cache_ttl'] ?? []);
        if (! $cacheTtl?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'cache_ttl']);
        }
        $this->cacheTtl = $cacheTtl;
        $this->cacheTtl->getValue()->getExpressionValue()?->setIsStringTemplate(true);

        return [
            'cache_scope' => $this->cacheScope->value,
            'cache_key' => $this->cacheKey->toArray(),
            'cache_value' => $this->cacheValue->toArray(),
            'cache_ttl' => $this->cacheTtl->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'cache_scope' => CacheScope::Topic->value,
            'cache_key' => ComponentFactory::generateTemplate(StructureType::Value),
            'cache_value' => ComponentFactory::generateTemplate(StructureType::Value),
            'cache_ttl' => ComponentFactory::generateTemplate(StructureType::Value),
        ]);
    }
}
