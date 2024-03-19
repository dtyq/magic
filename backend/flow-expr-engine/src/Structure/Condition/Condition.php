<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Condition;

use Dtyq\FlowExprEngine\Structure\CodeRunner;
use Dtyq\FlowExprEngine\Structure\Structure;
use Dtyq\FlowExprEngine\Structure\StructureType;

class Condition extends Structure
{
    public StructureType $structureType = StructureType::Condition;

    private Ops $ops;

    /**
     * @var array<Condition|ConditionItem>
     */
    private array $items;

    public function __construct(Ops $ops, array $items)
    {
        $this->ops = $ops;
        $this->items = $items;

        $this->check(false);
    }

    public function getOps(): Ops
    {
        return $this->ops;
    }

    public function setOps(Ops $ops): void
    {
        $this->ops = $ops;
    }

    public function getItems(): array
    {
        return $this->items;
    }

    public function setItems(array $items): void
    {
        $this->items = $items;
    }

    public function getFirstRow(): ?ConditionItem
    {
        $firstRow = $this->getItems()[0] ?? null;
        if ($firstRow instanceof Condition) {
            return $firstRow->getFirstRow();
        }
        return $firstRow;
    }

    public function jsonSerialize(): array
    {
        $items = [];
        foreach ($this->items as $item) {
            if ($item instanceof Condition) {
                $items[] = $item->toArray();
            }

            if ($item instanceof ConditionItem) {
                $items[] = $item->toArray();
            }
        }
        return [
            'ops' => $this->ops->getValue(),
            'children' => $items,
        ];
    }

    public function getAllFieldsExpressionItem(): array
    {
        $fields = [];
        foreach ($this->items as $item) {
            if ($item instanceof Condition) {
                $fields = array_merge($fields, $item->getAllFieldsExpressionItem());
            }
            if ($item instanceof ConditionItem) {
                if ($item->getType() === ConditionItemType::Compare) {
                    if ($leftExpression = $item->getLeftOperands()?->getExpressionValue()) {
                        $fields = array_merge($fields, $leftExpression->getAllFieldsExpressionItem());
                    }
                    if ($rightExpression = $item->getRightOperands()?->getExpressionValue()) {
                        $fields = array_merge($fields, $rightExpression->getAllFieldsExpressionItem());
                    }
                }
                if ($item->getType() === ConditionItemType::Operation) {
                    if ($operands = $item->getOperands()) {
                        $fields = array_merge($fields, $operands->getAllFieldsExpressionItem());
                    }
                }
            }
        }
        return $fields;
    }

    public function getCode(): string
    {
        return CodeRunner::getCodeByCondition($this);
    }

    public function getResult(array $sourceData = []): bool
    {
        $sourceData = $this->generateTransValue($sourceData);
        $this->formatSourceData($sourceData);
        return (bool) CodeRunner::execute($this->getCode(), $sourceData);
    }

    public function generateTransValue(array $sourceData = []): array
    {
        foreach ($this->items as $item) {
            if ($item instanceof Condition) {
                $sourceData = $item->generateTransValue($sourceData);
            }
            if ($item instanceof ConditionItem) {
                if ($leftExpression = $item->getLeftOperands()?->getExpressionValue()) {
                    $sourceData = $leftExpression->generateTransValue($sourceData);
                }
                if ($rightExpression = $item->getRightOperands()?->getExpressionValue()) {
                    $sourceData = $rightExpression->generateTransValue($sourceData);
                }
            }
        }
        return $sourceData;
    }

    private function check(bool $cache = true): void
    {
        CodeRunner::check($this->getCode(), $cache);
    }

    private function formatSourceData(array &$sourceData): void
    {
        foreach ($sourceData as &$sourceDatum) {
            if (is_array($sourceDatum)) {
                // 将空数组置为 null 值，用于 isset 的判断
                if (empty($sourceDatum)) {
                    $sourceDatum = null;
                } else {
                    $this->formatSourceData($sourceDatum);
                }
            }
        }
    }
}
