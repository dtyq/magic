<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Extensions\TextAlign;

test('text align is rendered correctly', function () {
    $document = [
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
    ];

    $result =
        (new Editor([
            'extensions' => [
                new StarterKit,
                new TextAlign([
                    'types' => ['paragraph'],
                ]),
            ],
        ]))
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<p style="text-align: center;">Example Text</p>');
});

test('default text align isn’t rendered', function () {
    $document = [
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
    ];

    $result =
        (new Editor([
            'extensions' => [
                new StarterKit,
                new TextAlign([
                    'types' => ['paragraph'],
                ]),
            ],
        ]))
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<p>Example Text</p>');
});

test('default text align is configureable', function () {
    $document = [
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
    ];

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
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<p>Example Text</p>');
});
