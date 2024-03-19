<?php

use Tiptap\Editor;

test('emojis are transformed correctly', function () {
    $html = "<p>🔥</p>";

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
                        'text' => "🔥",
                    ],
                ],
            ],
        ],
    ]);
});
