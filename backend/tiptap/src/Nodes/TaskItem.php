<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class TaskItem extends Node
{
    public static $name = 'taskItem';

    public static $priority = 1000;

    public function addOptions()
    {
        return [
            'HTMLAttributes' => [],
        ];
    }

    public function addAttributes()
    {
        return [
            'checked' => [
                'default' => false,
                'renderHTML' => fn ($attributes) => [
                    'data-checked' => $attributes->checked ?? null,
                ],
            ],
        ];
    }

    public function parseHTML()
    {
        return [
            [
                'tag' => 'li[data-type="' . self::$name . '"]',
            ],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return [
            'li',
            HTML::mergeAttributes(
                $this->options['HTMLAttributes'],
                $HTMLAttributes,
                ['data-type' => self::$name],
            ),
            [
                'label',
                [
                    'input',
                    [
                        'type' => 'checkbox',
                        'checked' => $node->attrs->checked ?? null
                        ? 'checked'
                        : null,
                    ],
                ],
                ['span'],
            ],
            [
                'div',
                0,
            ],
        ];
    }

    public static function wrapper($DOMNode)
    {
        if (
            $DOMNode->childNodes->length === 1
            && $DOMNode->childNodes[0]->nodeName == "p"
        ) {
            return null;
        }

        return [
            'type' => 'paragraph',
        ];
    }
}
