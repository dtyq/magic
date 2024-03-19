<?php

namespace Tiptap\Marks;

use Tiptap\Core\Mark;
use Tiptap\Utils\HTML;

class Superscript extends Mark
{
    public static $name = 'superscript';

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
                'tag' => 'sup',
            ],
            [
                'style' => 'vertical-align=super',
            ],
        ];
    }

    public function renderHTML($mark, $HTMLAttributes = [])
    {
        return ['sup', HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes), 0];
    }
}
