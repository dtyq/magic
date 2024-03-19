<?php

use Tiptap\Editor;

test('code gets rendered correctly', function () {
    $html = '<p><code>Example Text</code></p>';

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
                        'text' => 'Example Text',
                        'marks' => [
                            [
                                'type' => 'code',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});
