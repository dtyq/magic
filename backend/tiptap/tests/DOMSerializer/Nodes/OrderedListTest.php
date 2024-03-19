<?php

use Tiptap\Editor;

test('orderedList node gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'orderedList',
                'content' => [
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => 'first list item',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<ol><li>first list item</li></ol>');
});

test('function orderedList has offset', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'orderedList',
                'attrs' => [
                    'start' => 3,
                ],
                'content' => [
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => 'first list item',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<ol start="3"><li>first list item</li></ol>');
});
