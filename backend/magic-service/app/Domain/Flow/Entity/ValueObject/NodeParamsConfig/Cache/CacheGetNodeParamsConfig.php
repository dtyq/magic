<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Cache;

use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Hyperf\Codec\Json;

class CacheGetNodeParamsConfig extends NodeParamsConfig
{
    private CacheScope $cacheScope;

    private Component $cacheKey;

    public function getCacheScope(): CacheScope
    {
        return $this->cacheScope;
    }

    public function getCacheKey(): Component
    {
        return $this->cacheKey;
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

        return [
            'cache_scope' => $cacheScope->value,
            'cache_key' => $cacheKey->jsonSerialize(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'cache_scope' => CacheScope::Topic,
            'cache_key' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
        ]);

        $output = new NodeOutput();
        $output->setForm(ComponentFactory::generateTemplate(StructureType::Form, Json::decode(<<<'JSON'
{
    "type": "object",
    "key": "root",
    "sort": 0,
    "title": "root节点",
    "description": "",
    "items": null,
    "value": null,
    "required": [
        "cache_value"
    ],
    "properties": {
        "cache_value": {
            "type": "string",
            "key": "cache_value",
            "sort": 0,
            "title": "缓存值",
            "description": "",
            "items": null,
            "properties": null,
            "required": null,
            "value": null
        }
    }
}
JSON)));
        $this->node->setOutput($output);
    }
}
