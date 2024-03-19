<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class TableRow extends Node
{
    public static $name = 'tableRow';

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
                'tag' => 'tr',
            ],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return ['tr', HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes), 0];
    }
}
