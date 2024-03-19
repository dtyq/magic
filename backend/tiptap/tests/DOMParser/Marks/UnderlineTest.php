<?php


use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Underline;

test('underline gets rendered correctly', function () {
    $html = '<p><u>Example Text</u></p>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Underline,
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
                                'type' => 'underline',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});

test('inline style is parsed correctly', function () {
    $html = '<p><span style="text-decoration: underline;">Example Text</span></p>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Underline,
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
                                'type' => 'underline',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});
