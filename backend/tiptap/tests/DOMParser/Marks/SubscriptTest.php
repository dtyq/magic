<?php


use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Subscript;

test('subscript gets rendered correctly', function () {
    $html = '<p><sub>Example Text</sub></p>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Subscript,
        ],
    ]))->setContent($html)->getDocument();

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
                                'type' => 'subscript',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});

test('inline style is parsed correctly', function () {
    $html = '<p><span style="vertical-align: sub;">Example Text</span></p>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Subscript,
        ],
    ]))->setContent($html)->getDocument();

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
                                'type' => 'subscript',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});
