<?php

namespace Tiptap\Tests\HTMLOutput;

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Link;

test('node content is string gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => 'test',
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toBeEmpty();
});

test('node content is empty array gets rendered correctly 1', function () {
    $document = [
        'type' => 'doc',
        'content' => [],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toBeEmpty();
});

test('node content is empty array gets rendered correctly 2', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [], [],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toBeEmpty();
});

test('node content contains empty array gets rendered correctly 3', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [],
            'test',
            [],
            '',
            [],
            [
                'type' => 'codeBlock',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Text',
                    ],
                ],
            ],
            [],
            [],
            [],
            '',
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<pre><code>Example Text</code></pre>');
});

test('node content contains empty array empty mark gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [],
            'test',
            [],
            '',
            [],
            [
                'type' => 'text',
                'text' => 'Example Link',
                'marks' => [
                    [],
                    '',
                    'test',
                    [
                        'type' => 'link',
                        'attrs' => [
                            'href' => 'https://tiptap.dev',
                        ],
                    ],
                ],
            ],
            [],
            [],
            [],
            '',
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
