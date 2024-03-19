<?php

use Tiptap\Editor;

test('emojis are transformed correctly()', function () {
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

test('extended emojis are transformed correctly()', function () {
    $html = "<p>👩‍👩‍👦</p>";

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
                        'text' => "👩‍👩‍👦",
                    ],
                ],
            ],
        ],
    ]);
});

test('umlauts are transformed correctly()', function () {
    $html = "<p>äöüÄÖÜß</p>";

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
                        'text' => "äöüÄÖÜß",
                    ],
                ],
            ],
        ],
    ]);
});

test('html entities are transformed correctly()', function () {
    $html = "<p>&lt;</p>";

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
                        'text' => "<",
                    ],
                ],
            ],
        ],
    ]);
});
