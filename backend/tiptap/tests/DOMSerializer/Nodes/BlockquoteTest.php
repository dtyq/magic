<?php

use Tiptap\Editor;

test('blockquote node gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'blockquote',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Quote',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)->setContent($document)->getHTML();

    expect($result)->toEqual('<blockquote>Example Quote</blockquote>');
});
