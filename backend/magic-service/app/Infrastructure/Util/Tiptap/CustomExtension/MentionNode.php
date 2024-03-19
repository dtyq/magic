<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionInterface;
use App\Infrastructure\Util\Tiptap\AbstractCustomNode;
use App\Interfaces\Agent\Assembler\MentionAssembler;
use Hyperf\Codec\Json;

/**
 * 富文本的@功能.
 */
class MentionNode extends AbstractCustomNode
{
    public static $name = 'mention';

    public function addAttributes(): array
    {
        return [
            'type' => [
                'type' => '',
                'isRequired' => true,
            ],
            'id' => [
                'default' => null,
                'isRequired' => false,
            ],
            'label' => [
                'default' => null,
                'isRequired' => false,
            ],
            'avatar' => [
                'default' => null,
            ],
            'attrs' => [
                'default' => null,
            ],
        ];
    }

    public function renderText($node): string
    {
        $nodeForArray = Json::decode(Json::encode($node));
        // 可能引用 superAgent 的文件/mcp/flow等
        $superAgentMention = MentionAssembler::fromArray($nodeForArray);
        if ($superAgentMention instanceof MentionInterface) {
            return $superAgentMention->getMentionTextStruct();
        }
        $userName = $nodeForArray['attrs']['label'] ?? '';
        return '@' . $userName;
    }
}
