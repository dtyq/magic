<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Form;

use Dtyq\FlowExprEngine\ComponentContext;
use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Kernel\Utils\AesUtil;
use Dtyq\FlowExprEngine\Kernel\Utils\Functions;
use Dtyq\FlowExprEngine\Structure\Expression\ExpressionDataSource\ExpressionDataSourceFields;
use Dtyq\FlowExprEngine\Structure\Expression\Value;
use Dtyq\FlowExprEngine\Structure\Expression\ValueType;
use Dtyq\FlowExprEngine\Structure\Structure;
use Dtyq\FlowExprEngine\Structure\StructureType;

/**
 * 表单组件，采用json-schema规范
 * https://json-schema.apifox.cn/
 * https://hellosean1025.github.io/json-schema-visual-editor/.
 */
class Form extends Structure
{
    public const ROOT_KEY = '__ROOT__';

    public StructureType $structureType = StructureType::Form;

    protected FormType $type;

    protected string $key;

    protected int $sort;

    protected ?string $title;

    protected ?string $description;

    /**
     * type为object时，properties是下级对象.
     * type为array时，这里存储的是值，作为值的时候，value优先于properties.
     * @var array<Form>
     */
    protected ?array $properties = null;

    /**
     * 只有object的时候，才会生效.
     */
    protected ?array $required = null;

    /**
     * type为array时，items生效.
     */
    protected ?Form $items = null;

    /**
     * type为基础类型(string、number、integer、boolean)时，value生效.
     * type为array时，该值永远为null.
     */
    protected ?Value $value = null;

    /**
     * 是否加密.
     */
    protected bool $encryption = false;

    /**
     * 加密后的值.
     */
    protected ?string $encryptionValue = null;

    private ?array $complexValue = null;

    public function __construct(
        FormType $type,
        string $key,
        int $sort,
        ?string $title = null,
        ?string $description = null,
        ?array $required = null,
        bool $encryption = false,
        ?string $encryptionValue = null
    ) {
        $this->type = $type;
        $this->key = $key;
        $this->sort = $sort;
        $this->title = $title;
        $this->description = $description;
        $this->setRequired($required);
        $this->setEncryption($encryption, $encryptionValue);
    }

    public function isRoot(): bool
    {
        return $this->key === Form::ROOT_KEY;
    }

    public function getType(): FormType
    {
        return $this->type;
    }

    public function setType(FormType $type): Form
    {
        $this->type = $type;
        return $this;
    }

    public function getKey(): string
    {
        if ($this->key === Form::ROOT_KEY) {
            return 'root';
        }
        return $this->key;
    }

    public function setKey(string $key): Form
    {
        $this->key = $key;
        return $this;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(int $sort): Form
    {
        $this->sort = $sort;
        return $this;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(?string $title): Form
    {
        $this->title = $title;
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): Form
    {
        $this->description = $description;
        return $this;
    }

    public function getProperties(): ?array
    {
        return $this->properties;
    }

    public function setProperties(?array $properties): Form
    {
        if (! $properties) {
            return $this;
        }
        if ($this->getType()->isComplex()) {
            // 只有复杂类型才有properties，其中object的properties是下级对象，array的properties是值
            $this->properties = $properties;
        }
        return $this;
    }

    public function getItems(): ?Form
    {
        return $this->items;
    }

    public function setItems(?Form $items): Form
    {
        if (! $items) {
            return $this;
        }
        if ($this->getType()->isArray()) {
            // 只有array类型才有items
            $this->items = $items;
        }
        return $this;
    }

    public function getValue(): ?Value
    {
        return $this->value;
    }

    public function setValue(?Value $value): Form
    {
        if (! $value) {
            return $this;
        }
        if ($this->getType()->isBasic()) {
            $this->value = $value;
        }
        // 如果是数组要设置value，那么应该检测一下value是否满足条件: 将只允许填写expression并且只有一个fields字段
        if ($this->getType()->isComplex()) {
            if ($value->getType() !== ValueType::Expression) {
                throw new FlowExprEngineException("[{$this->key}] 使用表达式来作为数组或对象的值，只允许传入表达式");
            }
            if (! $value->expressionIsOnlyFields()) {
                throw new FlowExprEngineException("[{$this->key}] 使用表达式来作为数组或对象的值，必须以表达式开头");
            }
            $this->value = $value;
        }
        $this->encrypt();
        return $this;
    }

    /**
     * 实际运算的value.
     */
    public function getExecuteValue(): ?Value
    {
        if ($this->encryption && $this->encryptionValue) {
            $key = ComponentContext::getSdkContainer()->getConfig()->get('flow_expr_engine.aes_key', 'aes_key') . '_' . $this->key;
            $valueStr = AesUtil::decode($key, $this->encryptionValue);
            $value = unserialize($valueStr);
            if ($value instanceof Value) {
                return $value;
            }
        }
        return $this->getValue();
    }

    public function getComplexValue(): ?array
    {
        return $this->complexValue;
    }

    public function setComplexValue(?array $complexValue): Form
    {
        $this->complexValue = $complexValue;
        return $this;
    }

    public function setRequired(?array $required): void
    {
        if ($this->type->isObject()) {
            $this->required = $required ?? [];
        }
    }

    public function setEncryption(?bool $encryption, ?string $encryptionValue): void
    {
        if ($this->type->isBasic()) {
            // 仅基础类型支持加密
            $this->encryption = $encryption;
            $this->encryptionValue = $encryptionValue;
        }
    }

    public function getRequired(): ?array
    {
        return $this->required;
    }

    public function jsonSerialize(): array
    {
        $properties = null;
        foreach ($this->getProperties() ?? [] as $key => $property) {
            $properties[$key] = $property->toArray();
        }

        return [
            'type' => $this->getType()->value,
            'key' => $this->getKey(),
            'sort' => $this->sort,
            'title' => $this->getTitle(),
            'description' => $this->getDescription(),
            'required' => $this->getRequired(),
            'value' => $this->getValue()?->jsonSerialize(),
            'encryption' => $this->encryption,
            'encryption_value' => $this->encryptionValue,
            'items' => $this->getItems()?->jsonSerialize(),
            'properties' => $properties,
        ];
    }

    public function toJsonSchema(bool $throw = false): array
    {
        $properties = null;
        foreach ($this->getProperties() ?? [] as $key => $property) {
            $properties[$key] = $property->toJsonSchema($throw);
        }
        $data = [
            'type' => $this->getType()->value,
            'required' => $this->getRequired() ?? [],
        ];
        if (! is_null($this->getDescription())) {
            $data['description'] = $this->getDescription();
        }
        if ($this->getType()->isObject()) {
            if ($throw && empty($properties)) {
                throw new FlowExprEngineException("[{$this->getKey()}] Object type must have properties");
            }
            // Only set properties if we have them or if we're in throw mode
            if (! empty($properties)) {
                $data['properties'] = $properties;
            }
        }
        if ($this->getType()->isArray()) {
            $items = $this->getItems();
            if (! $items) {
                // 尝试从 properties 中获取
                $items = $this->getProperties()[0] ?? null;
            }
            // 如果 items 有值，但是是空的对象，那么尝试从 properties 中获取
            if ($items && $items->getType()->isObject() && empty($items->getProperties())) {
                $items = $this->getProperties()[0] ?? null;
            }
            if ($throw && ! $items) {
                throw new FlowExprEngineException("[{$this->getKey()}] Array type must have items");
            }
            // Only set items if we have them or if we're in throw mode
            if ($items) {
                $data['items'] = $items->toJsonSchema($throw);
            }
        }

        return $data;
    }

    public function getAllFieldsExpressionItem(): array
    {
        $items = [];
        foreach ($this->getProperties() ?? [] as $property) {
            $items = array_merge($items, $property->getAllFieldsExpressionItem());
        }
        if ($this->getExecuteValue()) {
            $items = array_merge($items, $this->getExecuteValue()->getAllFieldsExpressionItem());
        }
        return $items;
    }

    public function getKeyValue(array $expressionSourceData = [], bool $check = false, string $expressionSourceDataPrefix = '', bool $execExpression = true)
    {
        if (empty($expressionSourceDataPrefix)) {
            $expressionSourceDataPrefix = $this->getComponentId();
        }

        $array = null;
        if ($this->getType()->isObject()) {
            if ($this->getExecuteValue()) {
                $array = $this->getExecuteValue()->getResult(sourceData: $expressionSourceData, execExpression: $execExpression, label: $this->getKey());
            } else {
                $array = [];
                foreach ($this->getProperties() ?? [] as $key => $property) {
                    $expressionSourceKey = $expressionSourceDataPrefix . '.' . $key;
                    if ($property->getType()->isComplex()) {
                        if (! is_null($property->getComplexValue())) {
                            $array[$key] = $property->getComplexValue();
                        } else {
                            $array[$key] = $property->getKeyValue($expressionSourceData, $check, $expressionSourceKey, $execExpression);
                        }
                    } else {
                        // 基础类型
                        if (! empty($property->getExecuteValue())) {
                            $array[$key] = $property->getExecuteValue()->getResult(sourceData: $expressionSourceData, execExpression: $execExpression, label: $this->getKey());
                            // 前置参数也放入表达式数据源
                            $newExpressionSourceData[$expressionSourceKey] = $array[$key];
                            $newExpressionSourceData = Functions::unFlattenArray($newExpressionSourceData);
                            $expressionSourceData = array_replace_recursive($expressionSourceData, $newExpressionSourceData);
                        }
                        if ($check && in_array($key, $this->getRequired())) {
                            $exists = array_key_exists($key, $array);
                            if ($property->getExecuteValue()?->isOldConstValue()) {
                                $exists = isset($array[$key]);
                            }
                            if (! $exists) {
                                throw new FlowExprEngineException("[{$key}]{$property->getTitle()} 不能为空");
                            }
                        }
                        if (! isset($array[$key])) {
                            $array[$key] = null;
                        }
                    }
                }
            }
        }

        if ($this->getType()->isArray()) {
            $expressionSourceKey = $expressionSourceDataPrefix . '.' . $this->getKey();

            $data = [];
            // 如果value有值，那么直接取value的值，没有再去properties里面取
            if ($this->getExecuteValue()) {
                $data = $this->getExecuteValue()->getResult(sourceData: $expressionSourceData, execExpression: $execExpression, label: $this->getKey());
            } else {
                foreach ($this->getProperties() ?? [] as $property) {
                    $data[] = $property->getKeyValue($expressionSourceData, $check, $expressionSourceKey, $execExpression);
                }
            }
            $array = $data;
        }

        if ($this->getType()->isBasic()) {
            $array = $this->getExecuteValue()?->getResult(sourceData: $expressionSourceData, execExpression: $execExpression, label: $this->getKey());
        }

        return $array;
    }

    public function getTitleValue(array $input): array
    {
        $previewData = [];
        if ($this->getType()->isObject()) {
            foreach ($this->getProperties() ?? [] as $key => $property) {
                $newKey = $property->getTitle() ?: $key;
                while (1) {
                    if (! isset($previewData[$newKey])) {
                        break;
                    }
                    $newKey = $newKey . '_copy';
                }
                if ($property->type->isComplex()) {
                    $nextInput = $input[$key] ?? [];
                    if (! is_array($nextInput)) {
                        throw new FlowExprEngineException("[{$key}] type error");
                    }
                    if ($property->getProperties()) {
                        $previewData[$newKey] = $property->getTitleValue($nextInput);
                    } else {
                        $previewData[$newKey] = $nextInput;
                    }
                } else {
                    $previewData[$newKey] = $input[$key] ?? null;
                }
            }
        }

        if ($this->getType()->isArray()) {
            if ($this->getItems()?->getType()->isComplex()) {
                foreach ($input as $item) {
                    $previewData[] = $this->getItems()->getTitleValue($item);
                }
            } else {
                $previewData = $input;
            }
        }

        return $previewData;
    }

    public function appendConstValue(array $input): void
    {
        if (! $input) {
            return;
        }
        if ($this->getType()->isObject()) {
            foreach ($this->getProperties() ?? [] as $key => $property) {
                if ($property->type->isComplex()) {
                    if ($property->getProperties()) {
                        $property->appendConstValue($input[$key] ?? []);
                    } else {
                        if (isset($input[$key])) {
                            if (! is_array($input[$key])) {
                                throw new FlowExprEngineException("[{$key}] type error");
                            }
                            $property->setComplexValue($input[$key]);
                        }
                    }
                } else {
                    if (isset($input[$key]) && $property->checkInputType($input[$key])) {
                        $property->setValue(Value::buildConst($input[$key]));
                    }
                }
            }
        }

        if ($this->getType()->isArray()) {
            // 如果items是空，默认加上一个string的items
            $this->setItems($this->getItems() ?? new Form(FormType::String, 'items', 0, 'items'));

            if ($this->getItems()->getType()->isComplex()) {
                $count = count($input);
                $properties = null;
                for ($i = 0; $i < $count; ++$i) {
                    $items = clone $this->getItems();
                    $items->appendConstValue($input[$i] ?? []);
                    $properties[] = $items;
                }
            } else {
                $properties = null;
                $index = 0;
                foreach ($input as $item) {
                    $property = clone $this->getItems();
                    $property->setValue(Value::buildConst($item));
                    $property->setSort($index++);
                    $properties[] = $property;
                }
            }
            $this->setProperties($properties);
        }
    }

    /**
     * 检测数据是否符合.
     */
    public function isMatch(array $input, bool $check = false): bool
    {
        if ($this->getType()->isObject()) {
            foreach ($this->getProperties() ?? [] as $key => $property) {
                if (in_array($key, $this->getRequired()) && ! isset($input[$key])) {
                    if ($check) {
                        throw new FlowExprEngineException($key . ' is required');
                    }
                    return false;
                }
                if ($property->type->isComplex()) {
                    $nextInput = $input[$key] ?? [];
                    if (! is_array($nextInput)) {
                        if ($check) {
                            throw new FlowExprEngineException($key . ' type error');
                        }
                        return false;
                    }
                    $property->isMatch($nextInput, $check);
                } else {
                    if (isset($input[$key]) && ! $property->checkInputType($input[$key])) {
                        if ($check) {
                            throw new FlowExprEngineException($key . ' type error');
                        }
                        return false;
                    }
                }
            }
        }

        if ($this->getType()->isArray()) {
            if ($this->getItems()?->getType()->isComplex()) {
                foreach ($input as $i => $item) {
                    $item = $item ?? [];
                    if (! is_array($item)) {
                        if ($check) {
                            throw new FlowExprEngineException("[{$this->getKey()}]的item[{$i}] type only array, but " . gettype($item) . ' given');
                        }
                        return false;
                    }
                    $this->getItems()->isMatch($item, $check);
                }
            }
        }

        return true;
    }

    public function getKeyNamesDataSource(string $label, ?string $desc = null, ?string $relationId = null, ?string $prefix = null): ExpressionDataSourceFields
    {
        $prefix = $prefix ?? $this->getComponentId();
        $expressionDataSource = new ExpressionDataSourceFields($label, uniqid('fields_'), $desc, $relationId);
        foreach ($this->getTileList() as $key => $title) {
            $value = "{$prefix}.{$key}";
            $expressionDataSource->addChildren($title, $value);
        }
        return $expressionDataSource;
    }

    /**
     * 获取平铺的数据，主要用于数据源的生成.
     */
    public function getTileList(string $keyPrefix = '', string $titlePrefix = ''): array
    {
        $list = [];

        if ($this->getType()->isObject()) {
            foreach ($this->getProperties() ?? [] as $key => $property) {
                $newKey = $keyPrefix ? $keyPrefix . '.' . $key : $key;
                $originTitle = $property->getTitle() ?: $key;
                $newTitle = $titlePrefix ? $titlePrefix . '.' . $originTitle : $originTitle;
                $list[$newKey] = $newTitle;
                if ($property->getType()->isComplex()) {
                    if ($property->getType()->isObject()) {
                        $list = array_merge($list, $property->getTileList($newKey, $newTitle));
                    }
                    if ($property->getType()->isArray()) {
                        if ($property->getItems()) {
                            $list = array_merge($list, $property->getItems()->getTileList($newKey . '[0]', $newTitle . '[0]'));
                        }
                    }
                }
            }
        }

        if ($this->getType()->isArray()) {
            $newKey = $keyPrefix ? $keyPrefix . '.' . $this->getKey() : $this->getKey();
            $originTitle = $this->getTitle() ?: $this->getKey();
            $newTitle = $titlePrefix ? $titlePrefix . '.' . $originTitle : $originTitle;
            $list[$newKey] = $newTitle;
            if ($this->getItems()->getType()->isComplex()) {
                $list = array_merge($list, $this->getItems()->getTileList($newKey . '[0]', $newTitle . '[0]'));
            }
        }

        return $list;
    }

    private function encrypt(): void
    {
        if (! $this->encryption) {
            $this->encryptionValue = null;
            return;
        }
        // 如果 value 没有值，但是 encryptionValue 有值，那么说明已经加密过了
        if (! $this->value && $this->encryptionValue) {
            return;
        }
        $valueStr = serialize($this->value);
        $key = ComponentContext::getSdkContainer()->getConfig()->get('flow_expr_engine.aes_key', 'aes_key') . '_' . $this->key;
        $this->encryptionValue = AesUtil::encode($key, $valueStr);
        $this->value = null;
    }

    private function checkInputType(mixed $input): bool
    {
        return match ($this->type) {
            FormType::String => is_string($input) || is_numeric($input),
            FormType::Number => is_numeric($input),
            FormType::Boolean => is_bool($input),
            FormType::Object, FormType::Array => is_array($input),
            FormType::Integer => is_integer($input),
            FormType::Expression => true,
            default => false,
        };
    }
}
