<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class Paragraph extends Node
{
    public static $name = 'paragraph';

    public static $priority = 1000;

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
                'tag' => 'p',
            ],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return ['p', HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes), 0];
    }
}
