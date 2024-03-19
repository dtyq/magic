<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class HorizontalRule extends Node
{
    public static $name = 'horizontalRule';

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
                'tag' => 'hr',
            ],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return ['hr', HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes)];
    }
}
