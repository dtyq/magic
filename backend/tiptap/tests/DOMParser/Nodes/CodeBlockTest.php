<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;

test('codeBlock gets rendered correctly', function () {
    $html = '<pre><code>Example Text</code></pre>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'codeBlock',
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

test('codeBlock with language gets rendered correctly', function () {
    $html = '<pre><code class="language-css">body { display: none }</code></pre>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'codeBlock',
                'attrs' => [
                    'language' => 'css',
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'body { display: none }',
                    ],
                ],
            ],
        ],
    ]);
});

test('language class prefix is configureable', function () {
    $html = '<pre><code class="custom-language-prefix-css">body { display: none }</code></pre>';

    $result =
        (new Editor([
            'extensions' => [
                new StarterKit([
                    'codeBlock' => [
                        'languageClassPrefix' => 'custom-language-prefix-',
                    ],
                ]),
            ],
        ]))
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'codeBlock',
                'attrs' => [
                    'language' => 'css',
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'body { display: none }',
                    ],
                ],
            ],
        ],
    ]);
});

test('code block and inline code are rendered correctly', function () {
    $html = '<p><code>Example Text</code></p><pre><code>body { display: none }</code></pre>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

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
                                'type' => 'code',
                            ],
                        ],
                    ],
                ],
            ],
            [
                'type' => 'codeBlock',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'body { display: none }',
                    ],
                ],
            ],
        ],
    ]);
});

test('it handles code blocks without a code tag', function () {
    $html = '<pre>body { display: none }</pre>';

    $result = (new Editor)->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'codeBlock',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'body { display: none }',
                    ],
                ],
            ],
        ],
    ]);
});
