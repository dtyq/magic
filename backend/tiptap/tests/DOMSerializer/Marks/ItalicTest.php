<?php

use Tiptap\Editor;

test('italic mark gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Example Text',
                'marks' => [
                    [
                        'type' => 'italic',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<em>Example Text</em>');
});
