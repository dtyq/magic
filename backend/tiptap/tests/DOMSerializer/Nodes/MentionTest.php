<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\Mention;

test('user mention is serialized correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Hey ',
                    ],
                    [
                        'type' => 'mention',
                        'attrs' => [
                            'id' => 123,
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ', was geht?',
                    ],
                ],
            ],
        ],
    ];

    $output = (new Editor([
        'extensions' => [
            new StarterKit,
            new Mention,
        ],
    ]))->setContent($document)->getHTML();

    expect($output)->toEqual('<p>Hey <span data-type="mention" data-id="123"></span>, was geht?</p>');
});

test('label can be customized', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Hey ',
                    ],
                    [
                        'type' => 'mention',
                        'attrs' => [
                            'id' => 123,
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ', was geht?',
                    ],
                ],
            ],
        ],
    ];

    $output = (new Editor([
        'extensions' => [
            new StarterKit,
            new Mention([
                'renderLabel' => fn ($node) => '@Philipp',
            ]),
        ],
    ]))->setContent($document)->getHTML();

    expect($output)->toEqual('<p>Hey <span data-type="mention" data-id="123">@Philipp</span>, was geht?</p>');
});

test('label can be customized and displayed for getText', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Hey ',
                    ],
                    [
                        'type' => 'mention',
                        'attrs' => [
                            'id' => 123,
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ', was geht?',
                    ],
                ],
            ],
        ],
    ];

    $output = (new Editor([
        'extensions' => [
            new StarterKit,
            new Mention([
                'renderLabel' => fn ($node) => '@Philipp',
            ]),
        ],
    ]))->setContent($document)->getText([
        'blockSeparator' => "",
    ]);

    expect($output)->toEqual('Hey @Philipp, was geht?');
});
