<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression;

use Dtyq\FlowExprEngine\Kernel\Traits\UnderlineObjectJsonSerializable;
use JsonSerializable;

class ExpressionItem implements JsonSerializable
{
    use UnderlineObjectJsonSerializable;

    protected ExpressionType $type;

    protected mixed $value;

    protected mixed $displayValue;

    protected string $name;

    /**
     * @var Value[]
     */
    protected ?array $args = null;

    protected ?string $trans = null;

    private ValueType $valueType;

    public function __construct(
        ExpressionType $type,
        mixed $value,
        string $name,
        ?array $args = null,
        ValueType $valueType = ValueType::Expression,
        ?string $trans = null,
    ) {
        $this->type = $type;
        $this->value = $value;
        $this->name = $name;
        $this->args = $args;
        $this->valueType = $valueType;
        $this->trans = $trans;
    }

    public function getType(): ExpressionType
    {
        return $this->type;
    }

    public function getValue(): mixed
    {
        return $this->value;
    }

    public function getDisplayValue(): mixed
    {
        return $this->displayValue;
    }

    public function setDisplayValue(mixed $displayValue): ExpressionItem
    {
        $this->displayValue = $displayValue;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getArgs(): ?array
    {
        return $this->args;
    }

    public function getValueType(): ValueType
    {
        return $this->valueType;
    }

    public function getTrans(): ?string
    {
        return $this->trans;
    }

    public function getTransKey(): string
    {
        return $this->trans ? $this->value . '_' . md5($this->trans) : '';
    }

    public function setTrans(?string $trans): ExpressionItem
    {
        $this->trans = $trans;
        return $this;
    }

    public function setValueType(ValueType $valueType): ExpressionItem
    {
        $this->valueType = $valueType;
        return $this;
    }

    public function jsonSerialize(): array
    {
        $data = [
            'type' => $this->type,
            'value' => $this->value,
            'name' => $this->name,
            'args' => $this->args,
        ];
        if (! is_null($this->trans)) {
            $data['trans'] = $this->trans;
        }
        if ($this->type->isDisplayValue()) {
            $data[$this->type->value . '_value'] = $this->displayValue;
        }
        return $data;
    }
}
