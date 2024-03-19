<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;

class CustomMark extends \Tiptap\Core\Mark
{
    public static $name = 'custom';

    public function parseHTML()
    {
        return [
            [
                'tag' => 'span',
            ],
        ];
    }

    public function addAttributes()
    {
        return [
            'foo' => [
                'parseHTML' => fn ($DOMNode) => $DOMNode->getAttribute('data-foo') ?: null,
            ],
            'fruit' => [],
        ];
    }
}

test('b and strong get rendered correctly', function () {
    $html = '<p><span data-foo="bar" fruit="banana">Example</span> text</p>';

    $result =
        (new Editor([
            'extensions' => [
                new StarterKit,
                new CustomMark,
            ],
        ]))
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example',
                        'marks' => [
                            [
                                'type' => 'custom',
                                'attrs' => [
                                    'foo' => 'bar',
                                    'fruit' => 'banana',
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ' text',
                    ],
                ],
            ],
        ],
    ]);
});
