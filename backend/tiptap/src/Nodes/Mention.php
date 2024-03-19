<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class Mention extends Node
{
    public static $name = 'mention';

    public function addOptions()
    {
        return [
            'HTMLAttributes' => [],
            'renderLabel' => fn () => null,
        ];
    }

    public function parseHTML()
    {
        return [
            [
                'tag' => 'span[data-type="' . self::$name . '"]',
            ],
        ];
    }

    public function addAttributes()
    {
        return [
            'id' => [
                'parseHTML' => fn ($DOMNode) => $DOMNode->getAttribute('data-id') ?: null,
                'renderHTML' => fn ($attributes) => ['data-id' => $attributes->id ?? null],
            ],
        ];
    }

    public function renderText($node)
    {
        return $this->options['renderLabel']($node);
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return [
            'span',
            HTML::mergeAttributes(
                ['data-type' => self::$name],
                $this->options['HTMLAttributes'],
                $HTMLAttributes,
            ),
            0,
        ];
    }
}
