<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Link;

test('link mark gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Example Link',
                'marks' => [
                    [
                        'type' => 'link',
                        'attrs' => [
                            'href' => 'https://tiptap.dev',
                        ],
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Link,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<a target="_blank" rel="noopener noreferrer nofollow" href="https://tiptap.dev">Example Link</a>');
});

test('link mark has support for rel', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Example Link',
                'marks' => [
                    [
                        'type' => 'link',
                        'attrs' => [
                            'href' => 'https://tiptap.dev',
                            'rel' => 'noopener',
                        ],
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Link,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<a target="_blank" rel="noopener" href="https://tiptap.dev">Example Link</a>');
});

test('link mark has support for target', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Example Link',
                'marks' => [
                    [
                        'type' => 'link',
                        'attrs' => [
                            'href' => 'https://tiptap.dev',
                            'target' => '_self',
                        ],
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Link,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<a target="_self" rel="noopener noreferrer nofollow" href="https://tiptap.dev">Example Link</a>');
});

test('link with marks generates clean output', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'marks' => [
                    [
                        'type' => 'link',
                        'attrs' => [
                            'href' => 'https://example.com',
                        ],
                    ],
                ],
                'text' => 'Example ',
            ],
            [
                'type' => 'text',
                'marks' => [
                    [
                        'type' => 'link',
                        'attrs' => [
                            'href' => 'https://example.com',
                        ],
                    ],
                    [
                        'type' => 'bold',
                    ],
                ],
                'text' => 'Link',
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Link,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">Example <strong>Link</strong></a>');
});

test('link with marks inside node generates clean output', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'marks' => [
                            [
                                'type' => 'link',
                                'attrs' => [
                                    'href' => 'https://example.com',
                                ],
                            ],
                        ],
                        'text' => 'Example ',
                    ],
                    [
                        'type' => 'text',
                        'marks' => [
                            [
                                'type' => 'link',
                                'attrs' => [
                                    'href' => 'https://example.com',
                                ],
                            ],
                            [
                                'type' => 'bold',
                            ],
                        ],
                        'text' => 'Link',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Link,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">Example <strong>Link</strong></a></p>');
});
