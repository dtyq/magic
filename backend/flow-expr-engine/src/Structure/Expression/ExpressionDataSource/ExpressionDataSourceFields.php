<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression\ExpressionDataSource;

class ExpressionDataSourceFields
{
    private string $label;

    private string $value;

    private ?string $desc;

    private ?string $relationId;

    /**
     * @var ExpressionDataSourceFields[]
     */
    private ?array $children = null;

    public function __construct(string $label, string $value, ?string $desc = null, ?string $relationId = null)
    {
        $this->label = $label;
        $this->value = $value;
        $this->desc = $desc;
        $this->relationId = $relationId;
    }

    public function getFields(): array
    {
        $list = [];
        foreach ($this->children ?? [] as $child) {
            $list[] = $child->getValue();
        }
        return $list;
    }

    public function isEmpty(): bool
    {
        return empty($this->children);
    }

    public function getRelationId(): ?string
    {
        return $this->relationId;
    }

    public function addChildren(string $label, string $value, ?string $desc = null, ?string $relationId = null): void
    {
        $this->children[] = new self($label, $value, $desc, $relationId);
    }

    public static function simpleMake(string $label, array $children, string $desc = '', ?string $relationId = null): ExpressionDataSourceFields
    {
        $dataSource = new self($label, uniqid('fields_'), $desc, $relationId);
        foreach ($children as $child) {
            if (! empty($child['label']) && ! empty($child['value'])) {
                $dataSource->addChildren($child['label'], $child['value'], $child['desc'] ?? '');
            }
        }
        return $dataSource;
    }

    public function toArray(): array
    {
        $data = [
            'label' => $this->label,
            'value' => $this->value,
        ];
        if (! is_null($this->desc)) {
            $data['desc'] = $this->desc;
        }
        if (! is_null($this->relationId)) {
            $data['relation_id'] = $this->relationId;
        }
        if (! is_null($this->children)) {
            $childData = [];
            foreach ($this->children as $child) {
                $childData[] = $child->toArray();
            }
            $data['children'] = $childData;
        }
        return $data;
    }

    public function getValue(): string
    {
        return $this->value;
    }
}
