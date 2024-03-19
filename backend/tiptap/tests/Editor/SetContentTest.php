<?php

use Tiptap\Editor;

test('json strings are detected', function () {
    $result = (new Editor)->setContent('{
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": "Example Text"
                    }
                ]
            }
        ]
    }')->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ]);
});


test('arrays are detected', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getDocument();

    expect($result)->toEqual($document);
});


test('html is detected', function () {
    $result = (new Editor)
        ->setContent('<p>Example <strong>Text</strong></p>')
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example ',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'Text',
                        'marks' => [
                            [
                                'type' => 'bold',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});

test('content can be passed to the configuration', function () {
    $result = (new Editor([
        'content' => '<p>Example Text</p>',
    ]))->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ]);
});
