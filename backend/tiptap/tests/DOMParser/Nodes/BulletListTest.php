<?php

use Tiptap\Editor;

test('bulletList gets rendered correctly', function () {
    $html = '<ul><li><p>Example</p></li><li><p>Text</p></li></ul>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'bulletList',
                'content' => [
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'Example',
                                    ],
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'Text',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});

test('bulletlistItem with text only gets wrapped in paragraph', function () {
    $html = '<ul><li>Example</li><li>Text <em>Test</em></li></ul>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'bulletList',
                'content' => [
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'Example',
                                    ],
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'Text ',
                                    ],
                                    [
                                        'type' => 'text',
                                        'text' => 'Test',
                                        'marks' => [
                                            [
                                                'type' => 'italic',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});

test('listItems with space get rendered correctly', function () {
    $html = '<ul><li> </li></ul>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'bulletList',
                'content' => [
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});
