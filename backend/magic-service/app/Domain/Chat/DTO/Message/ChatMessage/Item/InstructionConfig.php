<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage\Item;

use App\Domain\Chat\Entity\AbstractEntity;
use App\Domain\Chat\Entity\ValueObject\InstructionComponentType;
use App\Domain\Chat\Entity\ValueObject\InstructionDisplayType;
use App\Domain\Chat\Entity\ValueObject\InstructionInsertLocation;
use App\Domain\Chat\Entity\ValueObject\InstructionType;

/**
 * 指令配置实体类，根据 proto 定义.
 */
class InstructionConfig extends AbstractEntity
{
    /**
     * 指令内容.
     */
    protected string $content = '';

    /**
     * 指令描述.
     */
    protected string $description = '';

    /**
     * 指令属性，1 普通指令 2 系统指令.
     */
    protected int $displayType = InstructionDisplayType::Normal->value;

    /**
     * 指令ID.
     */
    protected string $id = '';

    /**
     * 指令插入位置，1 消息内容前方，2 消息内容中光标位置，3 消息内容后方.
     */
    protected int $insertLocation = InstructionInsertLocation::Cursor->value;

    /**
     * 指令类型, 取值 1 为流程指令，取值 2 为对话指令，默认为 对话指令。
     */
    protected int $instructionType = InstructionType::Conversation->value;

    /**
     * 指令名称.
     */
    protected string $name = '';

    /**
     * 直接发送指令，用户点击指令后将直接发送给助理.
     */
    protected bool $sendDirectly = false;

    /**
     * 指令组件类型，1 单选项 2 开关 3 文本类型 4 状态类型.
     */
    protected int $type = InstructionComponentType::Radio->value;

    /**
     * 指令值.
     *
     * @var InstructionValue[]
     */
    protected array $values = [];

    /**
     * 开关打开状态的文本描述.
     */
    protected string $on = '';

    /**
     * 开关关闭状态的文本描述.
     */
    protected string $off = '';

    /**
     * 常驻指令，默认只读.
     */
    protected bool $residency = true;

    protected bool $switch_off = false;

    protected bool $switch_on = false;

    protected string $defaultValue = '';

    public function __construct(array $instruction)
    {
        parent::__construct($instruction);
    }

    public function isFlowInstructionType(): bool
    {
        return $this->instructionType === InstructionType::Flow->value;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): void
    {
        $this->content = $content;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getDisplayType(): int
    {
        return $this->displayType;
    }

    public function setDisplayType($displayType): void
    {
        // 确保 display_type 是整数类型
        $this->displayType = is_numeric($displayType) ? (int) $displayType : InstructionDisplayType::Normal->value;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getInsertLocation(): int
    {
        return $this->insertLocation;
    }

    public function setInsertLocation($insertLocation): void
    {
        // 确保 insert_location 是整数类型
        $this->insertLocation = is_numeric($insertLocation) ? (int) $insertLocation : InstructionInsertLocation::Cursor->value;
    }

    public function getInstructionType(): int
    {
        return $this->instructionType;
    }

    public function setInstructionType($instructionType): void
    {
        // 确保 instruction_type 是整数类型
        $this->instructionType = is_numeric($instructionType) ? (int) $instructionType : InstructionType::Conversation->value;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function isSendDirectly(): bool
    {
        return $this->sendDirectly;
    }

    public function setSendDirectly($sendDirectly): void
    {
        // 确保 send_directly 是布尔类型
        $this->sendDirectly = filter_var($sendDirectly, FILTER_VALIDATE_BOOLEAN);
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType($type): void
    {
        // 确保 type 是整数类型
        $this->type = is_numeric($type) ? (int) $type : InstructionComponentType::Radio->value;
    }

    /**
     * @return InstructionValue[]
     */
    public function getValues(): array
    {
        return $this->values;
    }

    /**
     * @param null|array $values 原始值数组或 InstructionValue 对象数组，或 null
     */
    public function setValues($values): void
    {
        // 处理 null 值
        if ($values === null) {
            $this->values = [];
            return;
        }

        // 确保 $values 是数组
        if (! is_array($values)) {
            $this->values = [];
            return;
        }

        // 处理指令值数组
        if (empty($values)) {
            $this->values = [];
            return;
        }

        // 如果第一个元素已经是 InstructionValue 对象，则直接使用
        if (isset($values[0]) && $values[0] instanceof InstructionValue) {
            $this->values = $values;
            return;
        }

        // 否则，将每个元素转换为 InstructionValue 对象
        $processedValues = [];
        foreach ($values as $value) {
            $processedValues[] = new InstructionValue($value);
        }
        $this->values = $processedValues;
    }

    /**
     * 获取开关打开状态的文本描述.
     */
    public function getOn(): string
    {
        return $this->on;
    }

    /**
     * 设置开关打开状态的文本描述.
     * @param mixed $on
     */
    public function setOn($on): void
    {
        $this->on = (string) $on;
    }

    /**
     * 获取开关关闭状态的文本描述.
     */
    public function getOff(): string
    {
        return $this->off;
    }

    /**
     * 设置开关关闭状态的文本描述.
     * @param mixed $off
     */
    public function setOff($off): void
    {
        $this->off = (string) $off;
    }

    public function setResidency(bool $residency): void
    {
        $this->residency = $residency;
    }

    public function getResidency(): bool
    {
        return $this->residency;
    }

    public function getSwitchOff(): bool
    {
        return $this->switch_off;
    }

    public function getSwitchOn(): bool
    {
        return $this->switch_on;
    }

    public function setSwitchOff(bool $switch_off): void
    {
        $this->switch_off = $switch_off;
    }

    public function setSwitchOn(bool $switch_on): void
    {
        $this->switch_on = $switch_on;
    }

    public function getDefaultValue(): string
    {
        return $this->defaultValue;
    }

    public function setDefaultValue(mixed $defaultValue): void
    {
        $this->defaultValue = is_string($defaultValue) ? $defaultValue : '';
    }

    /**
     * 根据指令组件类型获取对应的名称和值.
     *
     * 类型为开关时，name 取的是 开/关，value 取 $instruction->getOn / $instruction->getOff
     * 类型为单选时, name 取的是 显示名称，value：$instructionValue
     * 类型为状态按钮时，name 取的是状态文本，value: $instructionValue
     * 默认 name 为空， value = $instructionValue
     *
     * @param string $instructionValue 指令值
     * @return array 返回包含 name 和 value 的数组
     */
    public function getNameAndValueByType(string $instructionValue): array
    {
        $name = '';
        $value = $instructionValue;

        switch ($this->type) {
            case InstructionComponentType::Switch->value:
                // 开关类型
                $name = $value;
                $value = ($instructionValue === 'on') ? $this->getOn() : $this->getOff();
                break;
            case InstructionComponentType::Radio->value:
                // 单选类型
                // 查找对应的 InstructionValue 对象
                foreach ($this->values as $instructionValueObj) {
                    if ($instructionValueObj->getId() === $instructionValue || $instructionValueObj->getValue() === $value) {
                        $name = $instructionValueObj->getName();
                        $value = $instructionValueObj->getValue();
                        break;
                    }
                }
                break;
            case InstructionComponentType::Status->value:
                // 状态按钮类型
                // 查找对应的 InstructionValue 对象
                foreach ($this->values as $instructionValueObj) {
                    if ($instructionValueObj->getValue() === $instructionValue) {
                        $name = $instructionValueObj->getName();
                        break;
                    }
                }
                break;
        }

        return [
            'name' => $name,
            'value' => $value,
        ];
    }
}
