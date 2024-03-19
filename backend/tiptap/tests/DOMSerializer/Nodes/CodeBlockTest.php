<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;

test('codeBlock node gets rendered correctly', function () {
    $document = [
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
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<pre><code>Example Text</code></pre>');
});

test('codeBlock language is rendered correctly', function () {
    $document = [
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
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<pre><code class="language-css">Example Text</code></pre>');
});

test('codeBlock language prefix is configureable', function () {
    $document = [
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
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
            'extensions' => [
                new StarterKit([
                    'codeBlock' => [
                        'languageClassPrefix' => 'custom-language-prefix-',
                    ],
                ]),
            ],
        ]))
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<pre><code class="custom-language-prefix-css">Example Text</code></pre>');
});
