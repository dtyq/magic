<?php

use Tiptap\Editor;

test('getHTML() returns HTML', function () {
    $input = [
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
        ->setContent($input)
        ->getHTML();

    expect($result)->toEqual('<p>Example Text</p>');
});
