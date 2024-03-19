<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression\ExpressionDataSource;

use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\ExecutableCode;

class ExpressionDataSourceMethods
{
    private string $label;

    private string $value;

    private ?string $desc = null;

    /**
     * @var ExpressionDataSourceMethods[]
     */
    private ?array $children = null;

    private ?string $returnType = null;

    private ?array $arg = null;

    public static function simpleMakeSystem(): ExpressionDataSourceMethods
    {
        // 第一层 类型
        $dataSource = new self();
        $dataSource->setLabel('函数');
        $dataSource->setValue(uniqid('methods_'));
        $dataSource->setDesc('');
        $groupDataSources = [];
        foreach (ExecutableCode::getMethods() as $method) {
            if ($method->isHide()) {
                continue;
            }
            $groupName = $method->getGroup();
            if (! $groupDataSource = $groupDataSources[$groupName] ?? null) {
                // 第二层 分组
                $groupDataSource = new self();
                $groupDataSource->setLabel($groupName);
                $groupDataSource->setValue(md5($groupName));
                $groupDataSource->setDesc('');
                $groupDataSources[$groupName] = $groupDataSource;
            }

            // 第三层 函数
            $methodDataSource = new self();
            $methodDataSource->setLabel($method->getName());
            $methodDataSource->setValue($method->getCode());
            $methodDataSource->setDesc($method->getDesc());
            $methodDataSource->setArg($method->getArgs());
            $methodDataSource->setReturnType($method->getReturnType());
            $groupDataSource->addChildren($methodDataSource);
        }
        $dataSource->setChildren($groupDataSources);
        return $dataSource;
    }

    public function setLabel(string $label): void
    {
        $this->label = $label;
    }

    public function setValue(string $value): void
    {
        $this->value = $value;
    }

    public function setDesc(?string $desc): void
    {
        $this->desc = $desc;
    }

    public function setChildren(?array $children): void
    {
        $this->children = $children;
    }

    public function addChildren(self $data): void
    {
        $this->children[] = $data;
    }

    public function setReturnType(?string $returnType): void
    {
        $this->returnType = $returnType;
    }

    public function setArg(?array $arg): void
    {
        $this->arg = $arg;
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
        if (! is_null($this->returnType)) {
            $data['return_type'] = $this->returnType;
        }
        if (! is_null($this->arg)) {
            $data['arg'] = $this->arg;
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
}
