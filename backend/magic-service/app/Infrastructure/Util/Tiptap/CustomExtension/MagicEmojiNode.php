<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension;

use App\Infrastructure\Util\Tiptap\AbstractCustomNode;
use Hyperf\Codec\Json;

/**
 * 富文本的表情解析.
 */
class MagicEmojiNode extends AbstractCustomNode
{
    public static $name = 'magic-emoji';

    public function addAttributes(): array
    {
        return [
            'code' => [
                'type' => '',
                'isRequired' => true,
            ],
            'suffix' => [
                'default' => null,
                'isRequired' => true,
            ],
            'size' => [
                'default' => null,
            ],
            'ns' => [
                'default' => null,
            ],
        ];
    }

    public function renderText($node): string
    {
        $nodeForArray = Json::decode(Json::encode($node));
        $magicEmoji = $nodeForArray['attrs']['code'] ?? '';
        ! empty($magicEmoji) && $magicEmoji = sprintf('[%s]', $magicEmoji);
        return $magicEmoji;
    }
}
