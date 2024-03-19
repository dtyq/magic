<?php

use Tiptap\Editor;

test('whitespace at the beginning is stripped', function () {
    $html = "<p>\nExample\n Text</p>";

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
                        'text' => "Example\nText",
                    ],
                ],
            ],
        ],
    ]);
});

test('whitespace in codeBlocks is ignored', function () {
    $html = "<p>\n" .
            "    Example Text\n" .
            "</p>\n" .
            "<pre><code>\n" .
            "Line of Code\n" .
            "    Line of Code 2\n" .
            "Line of Code</code></pre>";

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
                    ],
                ],
            ],
            [
                'type' => 'codeBlock',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => "Line of Code\n    Line of Code 2\nLine of Code",
                    ],
                ],
            ],
        ],
    ]);
});
