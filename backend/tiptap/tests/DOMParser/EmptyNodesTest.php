<?php

use Tiptap\Editor;

test('parsing must not fail on empty nodes', function () {
    $html = '<p><img /></p><p><img /></p>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [],
            ],
            [
                'type' => 'paragraph',
                'content' => [],
            ],
        ],
    ]);
});
