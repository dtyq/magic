<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Builder;

use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Structure\Condition\CompareType;
use Dtyq\FlowExprEngine\Structure\Condition\Condition;
use Dtyq\FlowExprEngine\Structure\Condition\ConditionItem;
use Dtyq\FlowExprEngine\Structure\Condition\ConditionItemType;
use Dtyq\FlowExprEngine\Structure\Condition\Ops;
use Dtyq\FlowExprEngine\Structure\Expression\Value;

class ConditionBuilder extends Builder
{
    public function build(array $structure): ?Condition
    {
        if (empty($structure)) {
            return null;
        }

        $ops = Ops::from($structure['ops'] ?? '');
        $children = $structure['children'] ?? null;
        if (! $children) {
            return null;
        }

        return new Condition(ops: $ops, items: $this->buildChildren($children));
    }

    public function template(string $componentId, array $structure = []): ?Condition
    {
        return $this->build($structure);
    }

    private function buildChildren(array $children): array
    {
        $items = [];
        foreach ($children as $child) {
            if (! empty($child['ops'])) {
                $items[] = $this->build($child);
            } else {
                $conditionItemType = ConditionItemType::from($child['type'] ?? '');

                $conditionItem = new ConditionItem();
                $conditionItem->setType($conditionItemType);
                $conditionItem->setTemplate(ComponentFactory::fastCreate($child['template'] ?? null));
                switch ($conditionItemType) {
                    case ConditionItemType::Operation:
                        if ($conditionItem->getTemplate()) {
                            $operands = $conditionItem->getTemplate()->getWidget()->getProperties()['operands']?->getValue();
                        } else {
                            $operands = Value::build($child['operands'] ?? null);
                        }

                        if (! $operands || $operands->isEmpty()) {
                            throw new FlowExprEngineException('比较值 不能为空');
                        }
                        $conditionItem->setOperands($operands);
                        $items[] = $conditionItem;
                        break;
                    case ConditionItemType::Compare:
                        if ($conditionItem->getTemplate()) {
                            $leftOperands = $conditionItem->getTemplate()->getWidget()->getProperties()['left_operands']?->getValue();
                            $rightOperands = $conditionItem->getTemplate()->getWidget()->getProperties()['right_operands']?->getValue();
                            $compareType = CompareType::from($conditionItem->getTemplate()->getWidget()->getProperties()['condition']?->getValue()?->getResult());
                        } else {
                            $leftOperands = Value::build($child['left_operands'] ?? []);
                            $rightOperands = Value::build($child['right_operands'] ?? []);
                            $compareType = CompareType::make($child['condition'] ?? null);
                        }

                        if (! $compareType) {
                            throw new FlowExprEngineException('比较类型 不能为空');
                        }
                        $conditionItem->setCompareType($compareType);
                        // 左侧的值必填
                        if (! $leftOperands || $leftOperands->isEmpty()) {
                            throw new FlowExprEngineException('左侧比较值 不能为空');
                        }
                        // 如果选择的是右侧必填项，检测一下右侧
                        if ($compareType->isRightOperandsRequired() && (! $rightOperands || $rightOperands->isEmpty())) {
                            throw new FlowExprEngineException('右侧比较值 不能为空');
                        }
                        $conditionItem->setLeftOperands($leftOperands);
                        $conditionItem->setRightOperands($rightOperands);
                        $items[] = $conditionItem;
                        break;
                }
            }
        }
        return $items;
    }
}
