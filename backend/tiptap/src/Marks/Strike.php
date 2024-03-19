<?php

namespace Tiptap\Marks;

use Tiptap\Core\Mark;
use Tiptap\Utils\HTML;

class Strike extends Mark
{
    public static $name = 'strike';

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
                'tag' => 's',
            ],
            [
                'tag' => 'del',
            ],
            [
                'tag' => 'strike',
            ],
            [
                'style' => 'text-decoration=line-through',
            ],
        ];
    }

    public function renderHTML($mark, $HTMLAttributes = [])
    {
        return ['strike', HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes), 0];
    }
}
