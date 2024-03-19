<?php

use Tiptap\Editor;

test('hr gets rendered correctly', function () {
    $html = '<p>Horizontal</p><hr /><p>Rule</p>';

    $result = (new Editor)
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
                        'text' => 'Horizontal',
                    ],
                ],
            ],
            [
                'type' => 'horizontalRule',
            ],
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Rule',
                    ],
                ],
            ],
        ],
    ]);
});
