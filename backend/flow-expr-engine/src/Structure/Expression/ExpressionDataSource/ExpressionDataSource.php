<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression\ExpressionDataSource;

class ExpressionDataSource
{
    /**
     * @var null|ExpressionDataSourceFields[]
     */
    protected ?array $systemFields = null;

    /**
     * @var null|ExpressionDataSourceMethods[]
     */
    protected ?array $systemMethods = null;

    /**
     * @var null|ExpressionDataSourceFields[]
     */
    protected ?array $customVariables = null;

    /**
     * @var null|ExpressionDataSourceMethods[]
     */
    protected ?array $customMethods = null;

    public function __construct(bool $loadSystemMethods = false)
    {
        $loadSystemMethods && $this->addSystemMethods(ExpressionDataSourceMethods::simpleMakeSystem());
    }

    public function getFields(): array
    {
        $list = [];
        foreach ($this->systemFields ?? [] as $systemField) {
            $list = array_merge($list, $systemField->getFields());
        }
        foreach ($this->customVariables ?? [] as $customVariable) {
            $list = array_merge($list, $customVariable->getFields());
        }
        return $list;
    }

    public function addSystemFields(?ExpressionDataSourceFields $systemFields): void
    {
        $this->systemFields[] = $systemFields;
    }

    public function addSystemMethods(?ExpressionDataSourceMethods $systemMethods): void
    {
        $this->systemMethods[] = $systemMethods;
    }

    public function addCustomVariable(?ExpressionDataSourceFields $customVariable): void
    {
        $this->customVariables[] = $customVariable;
    }

    public function addCustomMethods(?ExpressionDataSourceMethods $customMethods): void
    {
        $this->customMethods[] = $customMethods;
    }

    public function toArray(): array
    {
        $data = [];
        foreach ($this->systemFields ?? [] as $systemField) {
            $data[] = $systemField->toArray();
        }
        foreach ($this->customVariables ?? [] as $customVariable) {
            $data[] = $customVariable->toArray();
        }
        foreach ($this->systemMethods ?? [] as $systemMethod) {
            $data[] = $systemMethod->toArray();
        }
        foreach ($this->customMethods ?? [] as $customMethod) {
            $data[] = $customMethod->toArray();
        }
        return $data;
    }

    public function toJson(): string
    {
        return json_encode($this->toArray(), JSON_UNESCAPED_UNICODE);
    }
}
