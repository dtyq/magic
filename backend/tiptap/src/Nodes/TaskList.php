<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class TaskList extends Node
{
    public static $name = 'taskList';

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
                'tag' => 'ul[data-type="' . self::$name . '"]',
            ],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return ['ul', HTML::mergeAttributes(
            $this->options['HTMLAttributes'],
            $HTMLAttributes,
            ['data-type' => self::$name],
        ), 0];
    }
}
