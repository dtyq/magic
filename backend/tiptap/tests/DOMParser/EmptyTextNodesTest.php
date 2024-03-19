<?php

use Tiptap\Editor;

test('output_must_not_have_empty_text_nodes()', function () {
    $html = "<em><br />\n</em>";

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'hardBreak',
                'marks' => [
                    [
                        'type' => 'italic',
                    ],
                ],
            ],
        ],
    ]);
});
