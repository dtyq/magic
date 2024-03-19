<?php

use Tiptap\Editor;

test('mark doesn’t allow specific colors by default', function () {
    $document = [
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
                                'type' => 'highlight',
                                'attrs' => [
                                    'color' => 'red',
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ' Text',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new \Tiptap\Extensions\StarterKit,
            new \Tiptap\Marks\Highlight,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<p><mark>Example</mark> Text</p>');
});

test('mark allows specific colors when configured', function () {
    $document = [
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
                                'type' => 'highlight',
                                'attrs' => [
                                    'color' => 'red',
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ' Text',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new \Tiptap\Extensions\StarterKit,
            new \Tiptap\Marks\Highlight([
                'multicolor' => true,
            ]),
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<p><mark data-color="red" style="background-color: red;">Example</mark> Text</p>');
});
