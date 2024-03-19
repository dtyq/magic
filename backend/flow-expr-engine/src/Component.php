<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine;

use Dtyq\FlowExprEngine\Builder\ApiBuilder;
use Dtyq\FlowExprEngine\Builder\Builder;
use Dtyq\FlowExprEngine\Builder\ConditionBuilder;
use Dtyq\FlowExprEngine\Builder\ExpressionBuilder;
use Dtyq\FlowExprEngine\Builder\FormBuilder;
use Dtyq\FlowExprEngine\Builder\ValueBuilder;
use Dtyq\FlowExprEngine\Builder\WidgetBuilder;
use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Kernel\Traits\UnderlineObjectJsonSerializable;
use Dtyq\FlowExprEngine\Structure\Api\Api;
use Dtyq\FlowExprEngine\Structure\Condition\Condition;
use Dtyq\FlowExprEngine\Structure\Expression\Expression;
use Dtyq\FlowExprEngine\Structure\Expression\Value;
use Dtyq\FlowExprEngine\Structure\Form\Form;
use Dtyq\FlowExprEngine\Structure\Structure;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Dtyq\FlowExprEngine\Structure\Widget\Widget;
use JsonSerializable;

class Component implements JsonSerializable
{
    use UnderlineObjectJsonSerializable;

    /**
     * 组件标识.
     */
    private string $id;

    /**
     * 组件版本.
     */
    private string $version;

    /**
     * 组件类型.
     */
    private StructureType $type;

    /**
     * 组件结构体.
     */
    private ?Structure $structure = null;

    /**
     * 懒加载时记录的.
     */
    private ?array $structureLazy = null;

    public function toArray(): array
    {
        return $this->jsonSerialize();
    }

    public function jsonSerialize(): array
    {
        $structure = null;
        if ($this->structure) {
            $structure = $this->structure->toArray();
        } elseif ($this->structureLazy) {
            $structure = $this->structureLazy;
        }
        return [
            'id' => $this->getId(),
            'version' => $this->getVersion(),
            'type' => $this->getType()->value,
            'structure' => $structure,
        ];
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(?string $id): Component
    {
        $this->id = $id;
        return $this;
    }

    public function getVersion(): string
    {
        return $this->version;
    }

    public function setVersion(string $version): Component
    {
        $this->version = $version;
        return $this;
    }

    public function getType(): StructureType
    {
        return $this->type;
    }

    public function setType(StructureType $type): Component
    {
        $this->type = $type;
        return $this;
    }

    public function getStructure(): ?Structure
    {
        if ($this->structure) {
            return $this->structure;
        }
        // 如果有懒加载数据，同时没有已加载数据，那么进行一次数据加载
        if (! is_null($this->structureLazy)) {
            $this->initStructure($this->structureLazy);
            $this->structureLazy = null;
        }
        return $this->structure;
    }

    public function setStructure(?Structure $structure): Component
    {
        $this->structure = $structure;
        return $this;
    }

    public function getStructureLazy(): ?array
    {
        return $this->structureLazy;
    }

    public function setStructureLazy(?array $structureLazy): Component
    {
        $this->structureLazy = $structureLazy;
        return $this;
    }

    /**
     * @return Expression
     */
    public function getExpression(): Structure
    {
        return $this->getSpecificStructure(StructureType::Expression, Expression::class);
    }

    /**
     * @return Form
     */
    public function getForm(): Structure
    {
        return $this->getSpecificStructure(StructureType::Form, Form::class);
    }

    /**
     * @return Condition
     */
    public function getCondition(): Structure
    {
        return $this->getSpecificStructure(StructureType::Condition, Condition::class);
    }

    /**
     * @return Api
     */
    public function getApi(): Structure
    {
        return $this->getSpecificStructure(StructureType::Api, Api::class);
    }

    /**
     * @return Value
     */
    public function getValue(): Structure
    {
        return $this->getSpecificStructure(StructureType::Value, Value::class);
    }

    /**
     * @return Widget
     */
    public function getWidget(): Structure
    {
        return $this->getSpecificStructure(StructureType::Widget, Widget::class);
    }

    public function isExpression(): bool
    {
        return $this->is(StructureType::Expression);
    }

    public function isForm(): bool
    {
        return $this->is(StructureType::Form);
    }

    public function isCondition(): bool
    {
        return $this->is(StructureType::Condition);
    }

    public function isApi(): bool
    {
        return $this->is(StructureType::Api);
    }

    public function isValue(): bool
    {
        return $this->is(StructureType::Value);
    }

    public function initStructure(array|Structure|null $structure): void
    {
        if (is_array($structure)) {
            $builder = $this->getBuilder();
            $structure = $builder->build($structure);
        }
        if ($structure instanceof Structure) {
            $structure->setComponentId($this->id);
        }
        $this->structure = $structure;
    }

    public function createTemplate(array $structure): void
    {
        $builder = $this->getBuilder();
        $structure = $builder->template($this->id, $structure);
        $this->structure = $structure;
    }

    private function is(StructureType $type): bool
    {
        return $this->getType() === $type;
    }

    private function getSpecificStructure(StructureType $type, string $componentClass): Structure
    {
        $name = $type->name;
        if ($this->getType() !== $type) {
            throw new FlowExprEngineException("Component is not {$name}");
        }
        $specificStructure = $this->getStructure();
        if (is_null($specificStructure)) {
            // 生成默认组件格式
            $specificStructure = $this->getBuilder()->template($this->id);
        }
        if (! $specificStructure instanceof $componentClass) {
            throw new FlowExprEngineException("Component is not {$name}.");
        }
        return $specificStructure;
    }

    private function getBuilder(): ?Builder
    {
        return match ($this->type) {
            StructureType::Expression => new ExpressionBuilder(),
            StructureType::Form => new FormBuilder(),
            StructureType::Widget => new WidgetBuilder(),
            StructureType::Condition => new ConditionBuilder(),
            StructureType::Api => new ApiBuilder(),
            StructureType::Value => new ValueBuilder(),
            default => null,
        };
    }
}
