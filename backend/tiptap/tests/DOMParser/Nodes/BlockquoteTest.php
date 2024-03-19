<?php

use Tiptap\Editor;

test('blockquote gets rendered correctly', function () {
    $html = '<blockquote><p>Paragraph</p></blockquote>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'blockquote',
                'content' => [
                    [
                        'type' => 'paragraph',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => 'Paragraph',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});
