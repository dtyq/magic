<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Extensions\TextAlign;

test('text align is parsed correctly', function () {
    $html = '<p style="text-align: center;">Example Text</p>';

    $result =
        (new Editor([
            'extensions' => [
                new StarterKit,
                new TextAlign([
                    'types' => ['paragraph'],
                ]),
            ],
        ]))
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'attrs' => [
                    'textAlign' => 'center',
                ],
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

test('text align uses default value', function () {
    $html = '<p>Example Text</p>';

    $result =
        (new Editor([
            'extensions' => [
                new StarterKit,
                new TextAlign([
                    'types' => ['paragraph'],
                ]),
            ],
        ]))
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'attrs' => [
                    'textAlign' => 'left',
                ],
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

test('default text align is configureable', function () {
    $html = '<p>Example Text</p>';

    $result =
        (new Editor([
            'extensions' => [
                new StarterKit,
                new TextAlign([
                    'types' => ['paragraph'],
                    'defaultAlignment' => 'center',
                ]),
            ],
        ]))
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'attrs' => [
                    'textAlign' => 'center',
                ],
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
