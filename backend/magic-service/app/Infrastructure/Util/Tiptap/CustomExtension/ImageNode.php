<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap\CustomExtension;

use Hyperf\Codec\Json;
use Tiptap\Core\Node;

/**
 * 富文本的图片功能.
 */
class ImageNode extends Node
{
    public static $name = 'image';

    public function addAttributes(): array
    {
        return [
            'file_id' => [
                'default' => '',
                'isRequired' => true,
            ],
            'file_name' => [
                'default' => '',
                'isRequired' => true,
            ],
            'src' => [
                'default' => '',
            ],
            'alt' => [
                'default' => '',
            ],
            'title' => [
                'default' => '',
            ],
            'width' => [
                'default' => '',
            ],
            'height' => [
                'default' => '',
            ],
        ];
    }

    public function renderText($node): string
    {
        $nodeForArray = Json::decode(Json::encode($node));
        return $nodeForArray['attrs']['file_name'] ?? '';
    }
}
