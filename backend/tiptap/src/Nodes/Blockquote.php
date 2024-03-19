<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class Blockquote extends Node
{
    public static $name = 'blockquote';

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
                'tag' => 'blockquote',
            ],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return ['blockquote', HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes), 0];
    }
}
