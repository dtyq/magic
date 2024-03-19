<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\CodeBlockShiki;

test('editor can be created with codeBlockShiki extension', function () {
    $editor = (new Editor([
        'extensions' => [
            new StarterKit([
                'codeBlock' => false,
            ]),
            new CodeBlockShiki,
        ],
    ]));

    expect($editor->configuration['extensions'][1])
        ->toBeInstanceOf(CodeBlockShiki::class);
});

test('default theme can be set for codeBlockShiki extension', function () {
    $editor = (new Editor([
        'extensions' => [
            new StarterKit([
                'codeBlock' => false,
            ]),
            new CodeBlockShiki([
                'theme' => 'mojave',
            ]),
        ],
    ]));

    expect($editor->configuration['extensions'][1]->options['theme'])
        ->toEqual('mojave');
});

test('default language can be set for codeBlockShiki extension', function () {
    $editor = (new Editor([
        'extensions' => [
            new StarterKit([
                'codeBlock' => false,
            ]),
            new CodeBlockShiki([
                'defaultLanguage' => 'css',
            ]),
        ],
    ]));

    expect($editor->configuration['extensions'][1]->options['defaultLanguage'])
        ->toEqual('css');
});

test('code block and inline code are rendered correctly', function () {
    $html = '<p><code>Example Text</code></p><pre><code class="language-css">body { display: none }</code></pre>';

    $result = (new Editor([
        'extensions' => [
                new StarterKit([
                    'codeBlock' => false,
                ]),
                new CodeBlockShiki([
                    'defaultLanguage' => 'css',
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

test('html result is properly rendered', function () {
    $html = '<p><code>Example Text</code></p><pre><code class="language-css">body { display: none }</code></pre>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit([
                'codeBlock' => false,
            ]),
            new CodeBlockShiki([
                'defaultLanguage' => 'css',
            ]),
        ],
    ]))
        ->setContent($html)
        ->getHtml();

    expect($result)
        ->toEqual('<p><code>Example Text</code></p><pre class="shiki" style="background-color: #2e3440ff"><code><span class="line"><span style="color: #81A1C1">body</span><span style="color: #D8DEE9FF"> </span><span style="color: #ECEFF4">{</span><span style="color: #D8DEE9FF"> </span><span style="color: #D8DEE9">display</span><span style="color: #ECEFF4">:</span><span style="color: #D8DEE9FF"> </span><span style="color: #81A1C1">none</span><span style="color: #D8DEE9FF"> </span><span style="color: #ECEFF4">}</span></span></code></pre>');
});
