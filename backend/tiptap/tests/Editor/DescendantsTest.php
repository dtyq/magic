<?php

use Tiptap\Editor;

test('descendants() loops through all nodes recursively', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'bulletList',
                'content' => [
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'Example',
                                    ],
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'Text ',
                                    ],
                                    [
                                        'type' => 'text',
                                        'text' => 'Test',
                                        'marks' => [
                                            [
                                                'type' => 'italic',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example',
                    ],
                ],
            ],
        ],
    ];

    $editor = (new Editor)->setContent($document);

    $result = [];

    $editor->descendants(function ($node) use (&$result) {
        $result[] = $node->type;
    });

    expect($result)->toEqual([
        'doc',
        'bulletList',
        'listItem',
        'paragraph',
        'listItem',
        'paragraph',
        'paragraph',
    ]);
});

test('updating node attributes in descendants() works', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => 2,
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ];

    $editor = (new Editor)->setContent($document);

    // Set the level for all headings to 1
    $html = $editor->descendants(function (&$node) {
        if ($node->type !== 'heading') {
            return;
        }

        $node->attrs->level = 1;
    })->getHTML();

    expect($html)->toEqual('<h1>Example Text</h1>');
});
