<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Loop;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class LoopMainNodeParamsConfig extends NodeParamsConfig
{
    public function validate(): array
    {
        $params = $this->node->getParams();

        $type = LoopType::tryFrom($params['type'] ?? '');
        if ($type === null) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'type']);
        }
        $condition = ComponentFactory::fastCreate($params['condition'] ?? []);
        if (! $condition?->isCondition()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'condition']);
        }
        $count = ComponentFactory::fastCreate($params['count'] ?? []);
        if (! $count?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'count']);
        }
        $array = ComponentFactory::fastCreate($params['array'] ?? []);
        if (! $array?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'array']);
        }
        $maxLoopCount = ComponentFactory::fastCreate($params['max_loop_count'] ?? []);
        if (! $maxLoopCount?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'max_loop_count']);
        }

        return [
            'type' => $type->value,
            'condition' => $condition->toArray(),
            'count' => $count->toArray(),
            'array' => $array->toArray(),
            'max_loop_count' => $maxLoopCount->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            'type' => LoopType::Count->value,
            'condition' => ComponentFactory::generateTemplate(StructureType::Condition)->toArray(),
            'count' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
            'array' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
            'max_loop_count' => ComponentFactory::generateTemplate(StructureType::Value)->toArray(),
        ]);
        $this->node->setMeta([
            // 关联的循环体节点ID
            'relation_id' => '',
        ]);
    }
}
