<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Link;

test('paragraph with marks gets rendered correctly', function () {
    $html = "<p>Example <strong><em>Text</em></strong>.</p>";

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Link,
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
                        'text' => 'Example ',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'Text',
                        'marks' => [
                            [
                                'type' => 'bold',
                            ],
                            [
                                'type' => 'italic',
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => '.',
                    ],
                ],
            ],
        ],
    ]);
});

test('complex markup gets rendered correctly', function () {
    $html = '
        <h1>Headline 1</h1>
        <p>
            Some text. <strong>Bold Text</strong>. <em>Italic Text</em>. <strong><em>Bold and italic Text</em></strong>. Here is a <a href="https://tiptap.dev">Link</a>.
        </p>
    ';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Link,
        ],
    ]))->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => '1',
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Headline 1',
                    ],
                ],
            ],
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Some text. ',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'Bold Text',
                        'marks' => [
                            [
                                'type' => 'bold',
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => '. ',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'Italic Text',
                        'marks' => [
                            [
                                'type' => 'italic',
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => '. ',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'Bold and italic Text',
                        'marks' => [
                            [
                                'type' => 'bold',
                            ],
                            [
                                'type' => 'italic',
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => '. Here is a ',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'Link',
                        'marks' => [
                            [
                                'type' => 'link',
                                'attrs' => [
                                    'href' => 'https://tiptap.dev',
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => '.',
                    ],
                ],
            ],
        ],
    ]);
});

test('multiple lists gets rendered correctly', function () {
    $html = '
        <h2>Headline 2</h2>
        <ol>
            <li>ordered list item</li>
            <li>ordered list item</li>
            <li>ordered list item</li>
        </ol>
        <ul>
            <li>unordered list item</li>
            <li>unordered list item with <a href="https://tiptap.dev"><strong>link</strong></a></li>
            <li>unordered list item</li>
        </ul>
        <p>Some Text.</p>
    ';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Link,
        ],
    ]))->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' =>
        [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => '2',
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Headline 2',
                    ],
                ],
            ],
            [
                'type' => 'orderedList',
                'content' => [
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'ordered list item',
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
                                        'text' => 'ordered list item',
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
                                        'text' => 'ordered list item',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
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
                                        'text' => 'unordered list item',
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
                                        'text' => 'unordered list item with ',
                                    ],
                                    [
                                        'type' => 'text',
                                        'text' => 'link',
                                        'marks' => [
                                            [
                                                'type' => 'link',
                                                'attrs' => [
                                                    'href' => 'https://tiptap.dev',
                                                ],
                                            ],
                                            [
                                                'type' => 'bold',
                                            ],
                                        ],
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
                                        'text' => 'unordered list item',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Some Text.',
                    ],
                ],
            ],
        ],
    ]);
});
