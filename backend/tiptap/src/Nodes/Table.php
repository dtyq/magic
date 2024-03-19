<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class Table extends Node
{
    public static $name = 'table';

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
                'tag' => 'table',
            ],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return [
            'table',
            HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes),
            ['tbody', 0],
        ];
    }
}
