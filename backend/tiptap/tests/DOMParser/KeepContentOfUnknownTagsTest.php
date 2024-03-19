<?php

use Tiptap\Editor;

test('keeps content of unknown tags', function () {
    $html = "<p>Example <x-unknown-tag>Text</x-unknown-tag></p>";

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
                        'text' => "Example Text",
                    ],
                ],
            ],
        ],
    ]);
});

test('keeps content of unknown tags even if it has known tags', function () {
    $html = '<p>Example <x-unknown-tag><b>Text</b></x-unknown-tag></p>';

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
                        'text' => "Example ",
                    ],
                    [
                        'type' => 'text',
                        'text' => "Text",
                        'marks' => [
                            [
                                'type' => 'bold',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});
