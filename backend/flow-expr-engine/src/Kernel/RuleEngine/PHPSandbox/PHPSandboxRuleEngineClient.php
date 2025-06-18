<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox;

use DateTime;
use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\ExecutableCode;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\Options\ExecuteOption\AbstractExecuteOption;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\Options\ExecuteOption\ExpressionExecuteOption;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\RuleEngineClientInterface;
use Dtyq\FlowExprEngine\SdkInfo;
use Dtyq\FlowExprEngine\Structure\Condition\CompareType;
use Dtyq\FlowExprEngine\Structure\Condition\Condition;
use Dtyq\FlowExprEngine\Structure\Condition\ConditionItem;
use Dtyq\FlowExprEngine\Structure\Condition\ConditionItemType;
use Dtyq\FlowExprEngine\Structure\Expression\Expression;
use Dtyq\FlowExprEngine\Structure\Expression\ExpressionItem;
use Dtyq\FlowExprEngine\Structure\Expression\ExpressionType;
use Dtyq\FlowExprEngine\Structure\Expression\ValueType;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableConstant;
use Dtyq\RuleEngineCore\PhpScript\Admin\ExecutableFunction;
use Dtyq\RuleEngineCore\PhpScript\RuleServiceProvider;
use Dtyq\RuleEngineCore\Standards\RuleServiceProviderManager;
use Hyperf\Context\ApplicationContext;
use Throwable;

class PHPSandboxRuleEngineClient implements RuleEngineClientInterface
{
    public function __construct()
    {
        $this->register();
    }

    public function getCodeByExpression(Expression $expression): string
    {
        $codes = [];
        foreach ($expression->getItems() as $item) {
            $codes[] = $this->getExpressionItemCode($item);
        }
        if ($expression->isStringTemplate()) {
            $code = implode('.', array_map(function ($code) {
                if (is_numeric($code)) {
                    $code = trim($code, "'");
                    return "'{$code}'";
                }
                return $code;
            }, $codes));
        } else {
            $code = implode('', $codes);
        }
        return $code;
    }

    public function getCodeByCondition(Condition $condition): string
    {
        $str = '';
        $items = [];
        foreach ($condition->getItems() as $item) {
            if ($item instanceof Condition) {
                $items[] = $item->getCode();
            }

            if ($item instanceof ConditionItem) {
                $runString = $this->getConditionItemCode($item);
                if ($runString) {
                    $items[] = $runString;
                }
            }
        }
        if (! empty($items)) {
            $str = '(' . implode(' ' . $condition->getOps()->getCondition() . ' ', $items) . ')';
        }
        return $str;
    }

    public function getConditionItemCode(ConditionItem $conditionItem): string
    {
        $fn = match ($conditionItem->getType()) {
            ConditionItemType::Operation => function () use ($conditionItem) {
                return $conditionItem->getOperands()->getExpressionRunString();
            },
            ConditionItemType::Compare => function () use ($conditionItem) {
                $left = $conditionItem->getLeftOperands()->getExpressionRunString(true);
                $right = $conditionItem->getRightOperands()?->getExpressionRunString(true);
                $eq = '===';
                $notEq = '!==';
                // 判断左侧或者右侧有一方是纯数字类型的，那么不使用全等
                if ($conditionItem->getLeftOperands()?->isConstNumber() || $conditionItem->getRightOperands()?->isConstNumber()) {
                    $eq = '==';
                    $notEq = '!=';
                }

                // Handle Empty and NotEmpty comparisons specially for constant values
                if (in_array($conditionItem->getCompareType(), [CompareType::Empty, CompareType::NotEmpty, CompareType::Valuable, CompareType::NoValuable], true)) {
                    $value = trim(trim($left, '('), ')');
                    if (! str_starts_with($value, '$')) {
                        $isEmpty = ($value === 'null' || $value === '' || $value === '0' || $value === 'false' || $value === '[]');

                        return match ($conditionItem->getCompareType()) {
                            CompareType::Empty, CompareType::Valuable => $isEmpty ? 'true' : 'false',
                            CompareType::NotEmpty, CompareType::NoValuable => $isEmpty ? 'false' : 'true',
                            default => 'false',
                        };
                    }
                }

                return match ($conditionItem->getCompareType()) {
                    CompareType::Equals => "{$left} {$eq} {$right}",
                    CompareType::NoEquals => "{$left} {$notEq} {$right}",
                    CompareType::Contains => "str_contains({$left}, {$right})",
                    CompareType::NoContains => "!str_contains({$left}, {$right})",
                    CompareType::Gt => "{$left} > {$right}",
                    CompareType::Lt => "{$left} < {$right}",
                    CompareType::Gte => "{$left} >= {$right}",
                    CompareType::Lte => "{$left} <= {$right}",
                    // 一直使用了错误单词来表示
                    CompareType::Empty => "(!isset({$left}))", // 无值
                    CompareType::NotEmpty => "(isset({$left}))", // 有值
                    CompareType::Valuable => "({$left} ?? '') {$eq} ''", // 为空
                    CompareType::NoValuable => "({$left} ?? '') {$notEq} ''", // 不为空
                    default => '',
                };
            }
        };
        $runString = $fn();
        if ($runString === '') {
            return '';
        }
        return '(' . $runString . ')';
    }

    public function execute(string $code, array $data): mixed
    {
        $data = [
            'data' => $data,
        ];
        return $this->executeRules([$code], $data, $this->createExecuteOption())[0] ?? null;
    }

    public function isEffective(string $code): bool
    {
        // todo 这里可以缓存结果
        return $this->checkRules([$code], $this->createExecuteOption());
    }

    private function register(): void
    {
        $uri = SdkInfo::RULE_SERVICE_PROVIDER;
        $container = null;
        if (class_exists('Hyperf\Context\ApplicationContext')) {
            if (ApplicationContext::hasContainer()) {
                $container = ApplicationContext::getContainer();
            }
        } elseif (class_exists('Hyperf\Utils\ApplicationContext')) {
            if (\Hyperf\Utils\ApplicationContext::hasContainer()) {
                $container = \Hyperf\Utils\ApplicationContext::getContainer();
            }
        } else {
            throw new FlowExprEngineException('ApplicationContext not found');
        }

        RuleServiceProviderManager::registerRuleServiceProvider($uri, RuleServiceProvider::class, $container);
        $ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($uri);
        $admin = $ruleProvider->getRuleAdministrator();
        ExecutableCode::registerMethods();
        ExecutableCode::registerConstant();

        // 内置函数注册
        foreach (ExecutableCode::getMethods() as $method) {
            if ($method->getFunction()) {
                // 自定义函数
                $functionSet = new ExecutableFunction($method->getCode(), $method->getFunction());
            } else {
                // 内置函数
                $functionSet = ExecutableFunction::fromPhp($method->getCode(), $method->getCode());
            }
            $admin->registerExecutableCode($functionSet);
        }

        // 常量白名单定义
        foreach (ExecutableCode::getConstants() as $constant) {
            $constSet = new ExecutableConstant($constant);
            $admin->registerExecutableCode($constSet);
        }
    }

    private function getExpressionItemCode(ExpressionItem $expressionItem): string
    {
        $code = '';
        switch ($expressionItem->getType()) {
            case ExpressionType::Field:
                // 暂时采用.来区分多级字段
                $fields = explode('.', $expressionItem->getValue());
                $arrayKey = '';
                foreach ($fields as $field) {
                    if (is_string($field)) {
                        $field = $this->formatField($field);
                        $arrayKey .= $field;
                    }
                }
                if ($expressionItem->getTrans()) {
                    // 改变获取的是转换后的值
                    $arrayKey = "['{$expressionItem->getTransKey()}']";
                }
                if (! empty($arrayKey)) {
                    $code = '$data' . $arrayKey;
                }
                break;
            case ExpressionType::Input:
                $value = $expressionItem->getValue();
                if ($expressionItem->getValueType() === ValueType::Expression) {
                    return $value;
                }
                if (is_numeric($value) && ! str_contains($value, ' ')) {
                    return $value;
                }
                // 转义其中的 ' 符号
                $value = str_replace("'", "\\'", $value);
                $code = "'{$value}'";
                break;
            case ExpressionType::Method:
                $args = [];
                foreach ($expressionItem->getArgs() ?? [] as $arg) {
                    if (empty($arg)) {
                        continue;
                    }
                    $expression = match ($arg->getType()) {
                        ValueType::Const => $arg->getConstValue(),
                        ValueType::Expression => $arg->getExpressionValue(),
                    };
                    if (is_null($expression)) {
                        continue;
                    }
                    $args[] = '(' . $this->getCodeByExpression($expression) . ')';
                }
                if (count($args) === 1 && $args[0] === '()') {
                    $code = $expressionItem->getValue() . '()';
                } else {
                    $args = array_filter($args, fn ($arg) => $arg !== '()');
                    $code = $expressionItem->getValue() . '(' . implode(',', $args) . ')';
                }
                break;
            case ExpressionType::Datetime:
                $dateTimeType = $expressionItem->getDisplayValue()['type'] ?? '';
                $dateTimeValue = $expressionItem->getDisplayValue()['value'] ?? '';
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
                if ($dateTime) {
                    $code = "'" . $dateTime->format('Y-m-d H:i:s') . "'";
                }
                break;
            case ExpressionType::Checkbox:
                if (is_bool($expressionItem->getDisplayValue())) {
                    $code = $expressionItem->getDisplayValue() ? 'true' : 'false';
                }
                break;
            default:
        }
        return $code;
    }

    private function checkRules(array $ruleInputs, ?AbstractExecuteOption $executeOption = null): bool
    {
        try {
            $this->standardInputArgs($ruleInputs, $executeOption);

            $ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($executeOption->getUri());
            $admin = $ruleProvider->getRuleAdministrator();
            $ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider($executeOption->getInputType());
            $ruleExecutionSetProperties = $executeOption->getRuleExecutionSetProperties();
            $ruleExecutionSetProvider->createRuleExecutionSet($ruleInputs, $ruleExecutionSetProperties);
            $bindUri = $ruleExecutionSetProperties->getName();
            $admin->deregisterRuleExecutionSet($bindUri);
        } catch (Throwable $exception) {
            return false;
        }
        return true;
    }

    private function executeRules(array $ruleInputs, array $sourceData = [], ?AbstractExecuteOption $executeOption = null): array
    {
        $this->standardInputArgs($ruleInputs, $executeOption);

        $ruleProvider = RuleServiceProviderManager::getRuleServiceProvider($executeOption->getUri());
        $admin = $ruleProvider->getRuleAdministrator();
        $ruleExecutionSetProvider = $admin->getRuleExecutionSetProvider($executeOption->getInputType());
        $ruleExecutionSetProperties = $executeOption->getRuleExecutionSetProperties();
        $set = $ruleExecutionSetProvider->createRuleExecutionSet($ruleInputs, $ruleExecutionSetProperties);

        $bindUri = $ruleExecutionSetProperties->getName();
        $admin->registerRuleExecutionSet($bindUri, $set);
        $runtime = $ruleProvider->getRuleRuntime();
        $ruleSession = $runtime->createRuleSession($bindUri, $ruleExecutionSetProperties, $executeOption->getRuleSessionType());
        $result = $ruleSession->executeRules($sourceData);
        $ruleSession->release();
        $admin->deregisterRuleExecutionSet($bindUri);
        return $result;
    }

    private function createExecuteOption(): ExpressionExecuteOption
    {
        return new ExpressionExecuteOption();
    }

    private function standardInputArgs(array &$ruleInputs, ?AbstractExecuteOption &$executeOption = null): void
    {
        if (is_null($executeOption)) {
            $executeOption = new ExpressionExecuteOption();
        }

        array_walk($ruleInputs, function (&$ruleInput) {
            if (is_string($ruleInput)) {
                $ruleInput = str_replace('​', '', $ruleInput);
            }
        });
    }

    private function formatField(string $field): string
    {
        // todo 暂时直接取出字符串最后的[] 没有对很多特殊情况做处理，暂时先用着
        $pos = strpos($field, '[');
        if ($pos === false) {
            return "['{$field}']";
        }
        $property = substr($field, 0, $pos);
        $index = substr($field, $pos);
        return "['{$property}']{$index}";
    }
}
