<?php

use Tiptap\Editor;

test('self closing node gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'some text',
                    ],
                    [
                        'type' => 'hardBreak',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'some more text',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<p>some text<br>some more text</p>');
});
