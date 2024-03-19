<?php

namespace Tiptap\Nodes;

use Tiptap\Core\Node;
use Tiptap\Utils\HTML;

class CodeBlock extends Node
{
    public static $name = 'codeBlock';

    public static $marks = '';

    public function addOptions()
    {
        return [
            'languageClassPrefix' => 'language-',
            'HTMLAttributes' => [],
        ];
    }

    public function parseHTML()
    {
        return [
            [
                'tag' => 'pre',
            ],
        ];
    }

    public function addAttributes()
    {
        return [
            'language' => [
                'parseHTML' => function ($DOMNode) {
                    if (! ($DOMNode->childNodes[0] instanceof \DOMElement)) {
                        return null;
                    }

                    return preg_replace(
                        "/^" . $this->options['languageClassPrefix']. "/",
                        "",
                        $DOMNode->childNodes[0]->getAttribute('class')
                    ) ?: null;
                },
                'rendered' => false,
            ],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        return [
            'pre',
            HTML::mergeAttributes($this->options['HTMLAttributes'], $HTMLAttributes),
            [
                'code',
                [
                    'class' => $node->attrs->language ?? null
                        ? $this->options['languageClassPrefix'] . $node->attrs->language
                        : null,
                ],
                0,
            ],
        ];
    }
}
