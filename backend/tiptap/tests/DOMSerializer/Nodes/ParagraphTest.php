<?php

use Tiptap\Editor;

test('paragraph node gets rendered correctly()', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Paragraph',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<p>Example Paragraph</p>');
});
