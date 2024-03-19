<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Widget;

use Dtyq\FlowExprEngine\Structure\Widget\DisplayConfigExtra\AbstractExtra;
use Dtyq\FlowExprEngine\Structure\Widget\DisplayConfigExtra\NumberExtra;
use Dtyq\FlowExprEngine\Structure\Widget\DisplayConfigExtra\ObjectExtra;
use Dtyq\FlowExprEngine\Structure\Widget\DisplayConfigExtra\SelectExtra;
use Dtyq\FlowExprEngine\Structure\Widget\DisplayConfigExtra\SwitchExtra;

class DisplayConfig
{
    /**
     * 控件名称.
     */
    private string $label;

    /**
     * 控件类型.
     */
    private WidgetType $widgetType;

    /**
     * 说明.
     */
    private string $tooltips;

    /**
     * 是否必填.
     */
    private bool $required;

    /**
     * 是否可见.
     */
    private bool $visible;

    /**
     * 是否允许表达式.
     */
    private bool $allowExpression;

    /**
     * 是否禁用.
     */
    private bool $disabled;

    /**
     * 扩展配置.
     */
    private ?AbstractExtra $extra;

    /**
     * 用于存储前端额外的配置.
     */
    private ?array $webConfig = null;

    public static function create(?array $config, ?array $options): ?DisplayConfig
    {
        if (! $config || ! $options) {
            return null;
        }
        $widgetType = WidgetType::from($config['widget_type'] ?? null);

        $displayConfig = new self();
        $displayConfig->setLabel($config['label'] ?? '');
        $displayConfig->setWidgetType($widgetType);
        $displayConfig->setTooltips($config['tooltips'] ?? '');
        $displayConfig->setRequired((bool) ($config['required'] ?? false));
        $displayConfig->setVisible((bool) ($config['visible'] ?? true));
        $displayConfig->setAllowExpression((bool) ($config['allow_expression'] ?? true));
        $displayConfig->setDisabled((bool) ($config['disabled'] ?? false));

        $extra = match ($widgetType) {
            WidgetType::Number => NumberExtra::create($config),
            WidgetType::Switch => SwitchExtra::create($config),
            WidgetType::Select, WidgetType::Linkage => SelectExtra::create($config, $options),
            WidgetType::Object => ObjectExtra::create($config, $options),
            default => null,
        };

        $displayConfig->setExtra($extra);
        $displayConfig->setWebConfig($config['web_config'] ?? null);
        return $displayConfig;
    }

    public function setLabel(string $label): void
    {
        $this->label = $label;
    }

    public function setWidgetType(WidgetType $widgetType): void
    {
        $this->widgetType = $widgetType;
    }

    public function setTooltips(string $tooltips): void
    {
        $this->tooltips = $tooltips;
    }

    public function setRequired(bool $required): void
    {
        $this->required = $required;
    }

    public function setVisible(bool $visible): void
    {
        $this->visible = $visible;
    }

    public function setAllowExpression(bool $allowExpression): void
    {
        $this->allowExpression = $allowExpression;
    }

    public function setDisabled(bool $disabled): void
    {
        $this->disabled = $disabled;
    }

    public function setExtra(?AbstractExtra $extra): void
    {
        $this->extra = $extra;
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function getWidgetType(): WidgetType
    {
        return $this->widgetType;
    }

    public function getTooltips(): string
    {
        return $this->tooltips;
    }

    public function isRequired(): bool
    {
        return $this->required;
    }

    public function isVisible(): bool
    {
        return $this->visible;
    }

    public function isAllowExpression(): bool
    {
        return $this->allowExpression;
    }

    public function isDisabled(): bool
    {
        return $this->disabled;
    }

    public function getExtra(): ?AbstractExtra
    {
        return $this->extra;
    }

    public function getWebConfig(): ?array
    {
        return $this->webConfig;
    }

    public function setWebConfig(?array $webConfig): void
    {
        $this->webConfig = $webConfig;
    }

    public function toArray(): array
    {
        return [
            'label' => $this->getLabel(),
            'widget_type' => $this->getWidgetType()->value,
            'tooltips' => $this->getTooltips(),
            'required' => $this->isRequired(),
            'visible' => $this->isVisible(),
            'allow_expression' => $this->isAllowExpression(),
            'disabled' => $this->isDisabled(),
            'extra' => $this->getExtra()?->toArray(),
            'web_config' => $this->getWebConfig(),
        ];
    }
}
