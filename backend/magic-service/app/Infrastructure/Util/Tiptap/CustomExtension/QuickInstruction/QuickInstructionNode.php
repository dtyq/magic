<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension\QuickInstruction;

use App\Infrastructure\Util\Tiptap\AbstractCustomNode;
use App\Infrastructure\Util\Tiptap\CustomExtension\ValueObject\InstructionContentType;
use App\Infrastructure\Util\Tiptap\CustomExtension\ValueObject\InstructionType;
use App\Infrastructure\Util\Tiptap\CustomExtension\ValueObject\SwitchStatus;
use Hyperf\Codec\Json;

/**
 * 富文本的快捷指令.
 */
class QuickInstructionNode extends AbstractCustomNode
{
    public static $name = 'quick-instruction';

    public function addAttributes(): array
    {
        return [
            'value' => [
                'default' => '',
                'isRequired' => true,
            ],
            'instruction' => [
                'default' => null,
            ],
        ];
    }

    public function renderText($node): string
    {
        $nodeForArray = Json::decode(Json::encode($node));
        $instructionType = $nodeForArray['attrs']['instruction']['type'] ?? InstructionType::TEXT->value;
        $instruction = $nodeForArray['attrs']['instruction'] ?? [];
        switch (InstructionType::tryFrom($instructionType)) {
            case InstructionType::SWITCH:
                $templateContent = $nodeForArray['attrs']['instruction']['content'];
                $messageForStatusOn = $instruction['on'] ?? '';
                $messageForStatusOff = $instruction['off'] ?? '';
                $switchStatus = SwitchStatus::tryFrom($nodeForArray['attrs']['value'] ?? '');
                $switchText = $switchStatus === SwitchStatus::ON ? $messageForStatusOn : $messageForStatusOff;
                $value = '';
                if (json_validate($templateContent)) {
                    // 正常的格式
                    $templateContentParsed = Json::decode($templateContent);
                    foreach ($templateContentParsed as $item) {
                        switch (InstructionContentType::tryFrom($item['type'])) {
                            case InstructionContentType::TEXT:
                                $value .= $item['text'] ?? '';
                                break;
                            case InstructionContentType::QUICK_INSTRUCTION:
                                $value .= $switchText . ' ';
                                break;
                        }
                    }
                } else {
                    // 兼容旧的格式
                    $value .= $switchText . ' ';
                }

                return $value;
            case InstructionType::TEXT:
                return htmlspecialchars($nodeForArray['text'] ?? '', ENT_QUOTES, 'UTF-8');
            case InstructionType::SINGLE_CHOICE:
            default:
                // 前端传的 value 是 id 因此需要处理一下
                $value = $nodeForArray['attrs']['value'] ?? '';
                $instruction = $nodeForArray['attrs']['instruction'] ?? [];
                $values = $instruction['values'] ?? [];

                // 使用数组过滤和键值查找替代循环
                if (! empty($values) && is_array($values)) {
                    // 查找匹配 id 的指令值
                    $matchedValues = array_filter($values, function ($item) use ($value) {
                        return isset($item['id']) && $item['id'] == $value;
                    });

                    // 如果找到匹配项，取第一个匹配项的 value
                    if (! empty($matchedValues)) {
                        $firstMatch = reset($matchedValues);
                        $value = $firstMatch['value'] ?? $value;
                    }
                }

                return $value;
        }
    }
}
