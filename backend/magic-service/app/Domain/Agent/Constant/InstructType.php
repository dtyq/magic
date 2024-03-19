<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Constant;

use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Exception;

use function Hyperf\Translation\__;

enum InstructType: int
{
    case SINGLE_CHOICE = 1;  // 单选项
    case SWITCH = 2;         // 开关
    case TEXT = 3;          // 文本类型
    case STATUS = 4;        // 状态类型

    /**
     * 获取类型实例.
     */
    public static function fromType(int $type): self
    {
        return match ($type) {
            self::SINGLE_CHOICE->value => self::SINGLE_CHOICE,
            self::SWITCH->value => self::SWITCH,
            self::TEXT->value => self::TEXT,
            self::STATUS->value => self::STATUS,
            default => ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_type_invalid'),
        };
    }

    /**
     * 获取所有指令类型及其国际化标签.
     * @return array<string, int> 返回类型名称和对应的值
     */
    public static function getTypeOptions(): array
    {
        return [
            __('agent.instruct_type_single_choice') => self::SINGLE_CHOICE->value,
            __('agent.instruct_type_switch') => self::SWITCH->value,
            __('agent.instruct_type_text') => self::TEXT->value,
            __('agent.instruct_type_status_button') => self::STATUS->value,
        ];
    }

    /**
     * 验证指令值
     */
    public function validate(array &$items): void
    {
        // 其他类型的验证
        match ($this) {
            self::SINGLE_CHOICE => $this->validateSingleChoice($items),
            self::SWITCH => $this->validateSwitch($items),
            self::TEXT => $this->validateText($items),
            self::STATUS => $this->validateStatusGroup($items),
        };
    }

    /**
     * 判断指令类型是否需要content字段.
     */
    public static function requiresContent(int $type, ?int $displayType = null, ?int $instructionType = null): bool
    {
        // 如果是流程指令，则不可配置指令内容
        if ($instructionType == InstructCategory::FLOW) {
            return false;
        }

        // 如果是系统指令，使用SystemInstructType的判断
        if ($displayType === InstructDisplayType::SYSTEM) {
            return SystemInstructType::requiresContent($type);
        }

        // 普通指令的判断
        return match (self::fromType($type)) {
            self::STATUS => false,  // 状态类型不需要content
            self::SINGLE_CHOICE, self::SWITCH, self::TEXT => true,  // 其他类型需要content
        };
    }

    /**
     * 验证普通交互指令项.
     */
    public static function validateInstructItem(array &$item, array &$seenOuterNames): void
    {
        if (isset($item['display_type'])) {
            if ($item['display_type'] !== InstructDisplayType::SYSTEM) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.instruct_display_type_invalid');
            }
            SystemInstructType::fromType((int) $item['type']);
        } else {
            if (! isset($item['name']) || trim($item['name']) === '') {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_name_cannot_be_empty');
            }

            if (in_array($item['name'], $seenOuterNames, true)) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_name_cannot_be_duplicated');
            }
            $seenOuterNames[] = $item['name'];
            if (! isset($item['type'])) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_type_cannot_be_empty');
            }

            if (! is_numeric($item['type'])) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_type_must_be_numeric');
            }
        }

        // 验证content字段
        $instructionType = isset($item['instruction_type']) ? (int) $item['instruction_type'] : 0;
        if (self::requiresContent((int) $item['type'], $item['display_type'] ?? null, $instructionType)) {
            if (! isset($item['content']) || preg_match('/^\s*$/', $item['content'])) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_content_cannot_be_empty');
            }
        }

        // 流程指令不可配置 发送指令检测
        if ($instructionType == InstructCategory::FLOW && isset($item['send_directly']) && $item['send_directly']) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.send_directly_only_allow_flow_instruction');
        }

        if (! isset($item['id']) || $item['id'] === '') {
            $item['id'] = (string) IdGenerator::getSnowId();
        }

        // 如果是普通指令，验证类型
        if (! isset($item['display_type'])) {
            self::fromType((int) $item['type'])->validate($item);
        }
    }

    /**
     * 验证普通交互指令组.
     */
    public static function validateInstructs(array &$instructs): void
    {
        foreach ($instructs as &$group) {
            // 验证组类型
            if (! isset($group['position']) || ! isset($group['items'])) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.instruct_group_format_invalid');
            }

            // 验证组类型是否有效
            if (! is_numeric($group['position'])) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.instruct_group_type_must_be_numeric');
            }
            InstructGroupPosition::fromPosition((int) $group['position']);

            // 验证指令数量
            if (! is_array($group['items']) || (count($group['items']) - count(SystemInstructType::getTypeOptions())) > InstructGroupPosition::MAX_INSTRUCTS) {
                ExceptionBuilder::throw(
                    AgentErrorCode::VALIDATE_FAILED,
                    'agent.instruct_group_exceeds_max_limit',
                    ['max' => InstructGroupPosition::MAX_INSTRUCTS]
                );
            }
            $seenOuterNames = [];
            foreach ($group['items'] as &$item) {
                self::validateInstructItem($item, $seenOuterNames);
            }
            if (! isset($group['id']) || $group['id'] === '') {
                $group['id'] = (string) IdGenerator::getSnowId();
            }
        }
    }

    /**
     * 安全验证指令，捕获异常并返回结果.
     * @return array{success: bool, message: null|string}
     */
    public static function safeValidateInstructs(array &$instructs): array
    {
        try {
            self::validateInstructs($instructs);
            return ['success' => true, 'message' => null];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * 验证状态类型组.
     */
    private function validateStatusGroup(array &$items): void
    {
        if (! isset($items['values']) || ! is_array($items['values'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_items_invalid');
        }

        $totalItems = count($items['values']);
        // 验证状态项最小数量
        if ($totalItems < 2) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_items_min_count');
        }

        // 验证默认值
        if (! isset($items['default_value'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_default_value_required');
        }

        if (! is_int($items['default_value']) || $items['default_value'] < 1 || $items['default_value'] > $totalItems) {
            ExceptionBuilder::throw(
                AgentErrorCode::VALIDATE_FAILED,
                'agent.interaction_command_status_default_value_invalid',
                ['min' => 1, 'max' => $totalItems]
            );
        }

        // 验证状态项
        foreach ($items['values'] as &$item) {
            // 确保每个状态项都有ID
            if (! isset($item['id'])) {
                $item['id'] = (string) IdGenerator::getSnowId();
            }

            // 验证每个状态项
            $this->validateStatus($item);
        }
    }

    /**
     * 验证单选项类型.
     */
    private function validateSingleChoice(array &$item): void
    {
        if (! array_key_exists('values', $item) || ! is_array($item['values']) || count($item['values']) === 0) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_select_cannot_be_empty');
        }

        // 验证是否直接发送指令
        if (! isset($item['send_directly'])) {
            $item['send_directly'] = false;  // 默认不直接发送
        }

        if (! is_bool($item['send_directly'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_send_directly_must_be_boolean');
        }

        $seenValues = [];
        foreach ($item['values'] as &$value) {
            if (! is_array($value) || ! isset($value['name'], $value['value'])) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_value_invalid_format');
            }

            if (preg_match('/^\s*$/', $value['name']) || preg_match('/^\s*$/', $value['value'])) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_value_cannot_be_empty');
            }

            if (in_array($value['name'], $seenValues, true)) {
                ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_value_cannot_be_duplicated_within_group');
            }
            $seenValues[] = $value['name'];
            if (! isset($value['id']) || $value['id'] === '') {
                $value['id'] = (string) IdGenerator::getSnowId();
            }
        }
    }

    /**
     * 验证开关类型.
     */
    private function validateSwitch(array &$item): void
    {
        // 验证必须存在 on 和 off 字段
        if (! array_key_exists('on', $item) || ! array_key_exists('off', $item)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_switch_fields_missing');
        }

        // 验证默认值必须存在且必须 'on' 或 'off'
        if (! isset($item['default_value']) || ! in_array($item['default_value'], ['on', 'off'], true)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_switch_default_value_invalid');
        }
    }

    /**
     * 验证文本类型.
     */
    private function validateText(array &$item): void
    {
        // 验证是否直接发送指令
        if (! isset($item['send_directly'])) {
            $item['send_directly'] = false;  // 默认不直接发送
        }

        if (! is_bool($item['send_directly'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_send_directly_must_be_boolean');
        }
    }

    /**
     * 验证状态类型.
     */
    private function validateStatus(array &$item): void
    {
        // 验证图标
        if (! isset($item['icon'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_icon_required');
        }

        // 使用 StatusIcon 枚举验证图标值
        if (! StatusIcon::isValid($item['icon'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_icon_invalid');
        }

        // 验证状态文本
        if (! isset($item['status_text']) || empty($item['status_text'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_text_required');
        }

        // 验证文本颜色
        if (! isset($item['text_color'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_color_required');
        }

        // 使用 TextColor 枚举验证颜色值
        if (! TextColor::isValid($item['text_color'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_color_invalid');
        }

        // 验证指令值
        if (! isset($item['value']) || empty($item['value'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.interaction_command_status_value_required');
        }
    }
}
