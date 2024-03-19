<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Widget;

use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Structure\Expression\Value;
use Dtyq\FlowExprEngine\Structure\Form\Form;
use Dtyq\FlowExprEngine\Structure\Form\FormType;
use Dtyq\FlowExprEngine\Structure\StructureType;

/**
 * 采用form格式，所以直接继承.
 */
class Widget extends Form
{
    public StructureType $structureType = StructureType::Widget;

    private ?DisplayConfig $displayConfig = null;

    /**
     * 默认值.
     */
    private ?Value $initialValue = null;

    private ?ShowOptions $showOptions;

    public function __construct(
        FormType $type,
        string $key,
        int $sort,
        ?string $title = null,
        ?string $description = null,
        ?ShowOptions $showOptions = null,
    ) {
        parent::__construct($type, $key, $sort, $title, $description);
        $this->showOptions = $showOptions;
    }

    public function getExecuteValue(): ?Value
    {
        // 如果value为空，返回初始值
        return $this->value ?? $this->getInitialValue();
    }

    public function setDisplayConfig(?DisplayConfig $displayConfig): void
    {
        $this->displayConfig = $displayConfig;
    }

    public function getDisplayConfig(): ?DisplayConfig
    {
        return $this->displayConfig;
    }

    public function getInitialValue(): ?Value
    {
        return $this->initialValue;
    }

    public function setInitialValue(?Value $initialValue): void
    {
        $this->initialValue = $initialValue;
    }

    public function getValue(): ?Value
    {
        $value = parent::getValue();
        if ($value) {
            $isDesensitization = $this->displayConfig?->getWidgetType()->isDesensitization();
            if ($isDesensitization && $this->showOptions?->isDesensitization()) {
                $value = Value::buildConst('******');
            }
        }
        return $value;
    }

    public function validate(?DisplayConfig $displayConfig = null): void
    {
        $displayConfig = $displayConfig ?? $this->getDisplayConfig();

        $label = ($displayConfig?->getLabel() ?? $this->getKey()) . "[{$this->getKey()}] ";

        if ($this->getType()->isObject()) {
            /** @var Widget $property */
            foreach ($this->getProperties() ?? [] as $property) {
                $property->validate();
            }
        }

        if ($this->getType()->isArray()) {
            $itemType = $this->getItems()?->getType();
            if (! $itemType) {
                throw new FlowExprEngineException($label . 'items不能为空');
            }
            if ($itemType->isBasic()) {
                $value = $this->getValue() ?? null;
                if ($value) {
                    if ($displayConfig->isRequired() && $value->isEmpty()) {
                        throw new FlowExprEngineException($label . '不能为空');
                    }
                    if (! $displayConfig->isAllowExpression() && $value->isExpression()) {
                        throw new FlowExprEngineException($label . '不允许使用表达式');
                    }
                } else {
                    $properties = $this->getProperties();
                    if ($displayConfig->isRequired() && ! $properties) {
                        throw new FlowExprEngineException($label . '不能为空');
                    }
                }
            }
            if ($itemType->isObject()) {
                /** @var Widget $property */
                foreach ($this->getProperties() ?? [] as $property) {
                    $property->validate($displayConfig);
                }
            }
        }

        if ($this->getType()->isBasic()) {
            if (! $this->isRoot() && ! $displayConfig) {
                throw new FlowExprEngineException("[{$this->getKey()}] display_config不能为空");
            }

            $value = $this->getValue();

            if ($displayConfig->isRequired() && (! $value || $value->isEmpty())) {
                throw new FlowExprEngineException($label . '不能为空');
            }
            if (! $displayConfig->isAllowExpression() && $value && $value->isExpression()) {
                throw new FlowExprEngineException($label . '不允许使用表达式');
            }
        }
    }

    public function toArray(): array
    {
        $properties = null;
        /** @var Widget $property */
        foreach ($this->getProperties() ?? [] as $key => $property) {
            $properties[$key] = $property->toArray();
        }

        $value = $this->getValue();

        return [
            'type' => $this->getType()->value,
            'key' => $this->getKey(),
            'sort' => $this->sort,
            'title' => $this->getTitle(),
            'description' => $this->getDescription(),
            'initial_value' => $this->getInitialValue()?->jsonSerialize(),
            'value' => $value?->jsonSerialize(),
            'display_config' => $this->getDisplayConfig()?->toArray(),
            'items' => $this->getItems()?->toArray(),
            'properties' => $properties,
        ];
    }
}
