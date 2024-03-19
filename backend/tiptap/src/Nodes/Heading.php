<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class Heading extends Node
{
    public static $name = 'heading';

    public function addOptions()
    {
        return [
            'levels' => [1, 2, 3, 4, 5, 6],
            'HTMLAttributes' => [],
        ];
    }

    public function parseHTML()
    {
        return array_map(function ($level) {
            return [
                'tag' => "h{$level}",
                'attrs' => [
                    'level' => $level,
                ],
            ];
        }, $this->options['levels']);
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        $hasLevel = in_array($node->attrs->level, $this->options['levels']);

        $level = $hasLevel ?
            $node->attrs->level :
            $this->options['levels'][0];

        return [
            "h{$level}",
            HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes),
            0,
        ];
    }
}
