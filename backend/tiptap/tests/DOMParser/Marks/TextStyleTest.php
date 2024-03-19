<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\TextStyle;

test('span gets rendered correctly', function () {
    $html = '<p><span style="color: red">Example</span> Text</p>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new TextStyle,
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
                        'text' => 'Example',
                        'marks' => [
                            [
                                'type' => 'textStyle',
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ' Text',
                    ],
                ],
            ],
        ],
    ]);
});

test('span without inline style is ignored', function () {
    $html = '<p><span>Example</span> Text</p>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new TextStyle,
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
                    ],
                ],
            ],
        ],
    ]);
});
