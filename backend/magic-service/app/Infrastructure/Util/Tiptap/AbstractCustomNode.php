<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Tiptap;

use Tiptap\Core\Node;
use Tiptap\Extensions\RenderTextInterface;
use Tiptap\Utils\InlineStyle;

abstract class AbstractCustomNode extends Node implements RenderTextInterface
{
    public static $priority = 100;

    public function addOptions(): array
    {
        return [
        ];
    }

    public function parseHTML(): array
    {
        $name = self::$name;
        return [
            [
                'tag' => self::$name,
                'getAttrs' => function ($DOMNode) use ($name) {
                    return ! InlineStyle::hasAttribute($DOMNode, [
                        'data-type' => $name,
                    ]) ? null : false;
                },
            ],
        ];
    }

    public function renderHTML($node): array
    {
        $htmlAttributes = array_merge([], [
            'data-type' => self::$name,
        ]);

        return ['span', $htmlAttributes, 0];
    }
}
