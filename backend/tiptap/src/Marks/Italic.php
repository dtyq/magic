<?php

namespace Tiptap\Marks;

use Tiptap\Core\Mark;
use Tiptap\Utils\HTML;
use Tiptap\Utils\InlineStyle;

class Italic extends Mark
{
    public static $name = 'italic';

    public function addOptions()
    {
        return [
            'HTMLAttributes' => [],
        ];
    }

    public function parseHTML()
    {
        return [
            [
                'tag' => 'em',
            ],
            [
                'tag' => 'i',
                'getAttrs' => function ($DOMNode) {
                    return ! InlineStyle::hasAttribute($DOMNode, [
                        'font-style' => 'normal',
                    ]) ? null : false;
                },
            ],
            [
                'style' => 'font-style=italic',
            ],
        ];
    }

    public function renderHTML($mark, $HTMLAttributes = [])
    {
        return ['em', HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes), 0];
    }
}
