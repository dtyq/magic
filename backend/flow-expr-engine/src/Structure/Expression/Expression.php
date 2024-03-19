<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Expression;

use DateTime;
use Dtyq\FlowExprEngine\ComponentContext;
use Dtyq\FlowExprEngine\Kernel\Utils\Functions;
use Dtyq\FlowExprEngine\Structure\CodeRunner;
use Dtyq\FlowExprEngine\Structure\Structure;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Throwable;

use function Hyperf\Collection\data_get;

class Expression extends Structure
{
    public StructureType $structureType = StructureType::Expression;

    /**
     * @var ExpressionItem[]
     */
    protected array $items;

    private bool $isStringTemplate = false;

    public function __construct(array $items)
    {
        $this->items = $items;
    }

    public function getItems(): array
    {
        return $this->items;
    }

    public function jsonSerialize(): array
    {
        $array = parent::jsonSerialize();
        return $array['items'];
    }

    public function getAllFieldsExpressionItem(): array
    {
        $fields = [];
        foreach ($this->getItems() as $item) {
            if ($item->getType() === ExpressionType::Field) {
                $fields[] = $item;
            }
            foreach ($item->getArgs() ?? [] as $arg) {
                $fields = array_merge($fields, $arg->getAllFieldsExpressionItem());
            }
        }
        return $fields;
    }

    /**
     * 获取表达式运行的结果.
     */
    public function getResult(array $sourceData = [], bool $execExpression = true): mixed
    {
        if (! $execExpression) {
            return null;
        }
        // 这里可以提前做一些数据校验，比如变量是否存在于数据源
        $code = $this->getCode();
        $sourceData = $this->generateTransValue($sourceData);
        return CodeRunner::execute($code, $sourceData);
    }

    public function generateTransValue(array $sourceData): array
    {
        // 数据源格式新增
        foreach ($this->items as $expressionItem) {
            if ($expressionItem->getTrans()) {
                // 提前转换数据
                $value = data_get($sourceData, $expressionItem->getValue());
                $value = $this->getValueByTrans($expressionItem->getTrans(), $value, $expressionItem->getTransKey());
                $sourceData[$expressionItem->getTransKey()] = $value;
            }
            /** @var Value $arg */
            foreach ($expressionItem->getArgs() ?? [] as $arg) {
                if ($arg->getExpressionValue()) {
                    $sourceData += $arg->getExpressionValue()->generateTransValue($sourceData);
                }
                if ($arg->getConstValue()) {
                    $sourceData += $arg->getConstValue()->generateTransValue($sourceData);
                }
            }
        }
        return $sourceData;
    }

    /**
     * 获取固定值时的value .
     */
    public function getResultByConstValue(): mixed
    {
        $firstItem = $this->items[0] ?? null;
        if (! $firstItem) {
            return null;
        }
        if ($firstItem->getType() !== ExpressionType::Input) {
            return null;
        }
        return $firstItem->getValue();
    }

    public function getResultByDisplayValue(array $sourceData = []): mixed
    {
        $firstItem = $this->items[0] ?? null;
        if (! $firstItem) {
            return null;
        }
        $value = null;
        switch ($firstItem->getType()) {
            case ExpressionType::Datetime:
                $dateTimeType = $firstItem->getDisplayValue()['type'] ?? '';
                $dateTimeValue = $firstItem->getDisplayValue()['value'] ?? '';
                $dateTime = null;
                switch ($dateTimeType) {
                    case 'yesterday':
                    case 'today':
                    case 'tomorrow':
                        $dateTime = new DateTime($dateTimeType);
                        break;
                    case 'designation':
                        if (! empty($dateTimeValue)) {
                            $dateTime = new DateTime($dateTimeValue);
                        }
                        break;
                    case 'trigger_time':
                        $dateTime = new DateTime();
                        break;
                    default:
                        try {
                            $dateTime = new DateTime($dateTimeType);
                        } catch (Throwable $exception) {
                        }
                }
                $value = $dateTime?->format('Y-m-d H:i:s');
                break;
            case ExpressionType::Multiple:
            case ExpressionType::Select:
            case ExpressionType::Checkbox:
                $value = $firstItem->getDisplayValue() ?? null;
                break;
            case ExpressionType::Member:
            case ExpressionType::Names:
                $valueList = $firstItem->getDisplayValue() ?? null;
                $value = $valueList;
                if (is_array($valueList)) {
                    $value = [];
                    foreach ($valueList as $i => $item) {
                        $value[$i] = $item;
                        if (isset($item['type']) && $item['type'] === ExpressionType::Field->value) {
                            $itemValue = Value::buildExpression($item['value'] ?? '');
                            if ($itemValue) {
                                $value[$i] = $itemValue->getResult($sourceData);
                            }
                        }
                    }
                }
                break;
            default:
                $value = $firstItem->getDisplayValue() ?? null;
        }
        return $value;
    }

    public function isOldConstValue(): bool
    {
        if (count($this->items) !== 1) {
            return false;
        }
        $firstItem = $this->items[0] ?? null;
        if (! $firstItem) {
            return false;
        }
        if ($firstItem->getType() !== ExpressionType::Input) {
            return false;
        }
        return true;
    }

    public function isDisplayConstValue(): bool
    {
        if (count($this->items) !== 1) {
            return false;
        }
        $firstItem = $this->items[0] ?? null;
        if (! $firstItem) {
            return false;
        }
        if ($firstItem->getType()->isDisplayValue()) {
            return true;
        }
        return false;
    }

    public function getCode(bool $warpUp = false): string
    {
        $code = CodeRunner::getCodeByExpression($this);
        if ($warpUp) {
            $code = '(' . $code . ')';
        }
        return $code;
    }

    public function getStructureType(): StructureType
    {
        return $this->structureType;
    }

    public function setStructureType(StructureType $structureType): Expression
    {
        $this->structureType = $structureType;
        return $this;
    }

    public function isStringTemplate(): bool
    {
        return $this->isStringTemplate;
    }

    public function setIsStringTemplate(bool $isStringTemplate): Expression
    {
        $this->isStringTemplate = $isStringTemplate;
        // 将直接改变 input 的 value_type
        foreach ($this->items as $item) {
            if ($item->getType() === ExpressionType::Input) {
                $item->setValueType(ValueType::Const);
            }
        }
        return $this;
    }

    private function getValueByTrans(string $trans, mixed $value, string $transKey = ''): mixed
    {
        $trans = explode('.', $trans);
        foreach ($trans as $code) {
            $function = Functions::parseFunctionCallByCode($code);
            if ($function) {
                if (method_exists(ValueDataTypeTransform::class, $function['function'])) {
                    $oldValue = $value;
                    $value = ValueDataTypeTransform::{$function['function']}($oldValue, ...$function['arguments']);
                    Functions::logEnabled() && ComponentContext::getSdkContainer()->getLogger()->info('CodeRunner::Trans', [
                        'function' => $function,
                        'trans_key' => $transKey,
                        'old_value' => $oldValue,
                        'new_value' => $value,
                    ]);
                }
            }
        }
        return $value;
    }
}
