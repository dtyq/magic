<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\CodeBlockHighlight;

test('codeBlockHighlight adds syntax highlighting to code blocks', function () {
    $html = '<pre><code>body { display: none }</code></pre>';

    $result = (new Editor([
            'extensions' => [
                new StarterKit([
                    'codeBlock' => false,
                ]),
                new CodeBlockHighlight(),
            ],
        ]))
        ->setContent($html)
        ->getHTML();

    expect($result)->toEqual('<pre><code class="hljs css"><span class="hljs-selector-tag">body</span> { <span class="hljs-attribute">display</span>: none }</code></pre>');
});

test('codeBlockHighlight uses the specified language', function () {
    $html = '<pre><code class="hljs php">&lt;?php phpinfo()</code></pre>';

    $result = (new Editor([
            'extensions' => [
                new StarterKit([
                    'codeBlock' => false,
                ]),
                new CodeBlockHighlight(),
            ],
        ]))
        ->setContent($html)
        ->getHTML();

    expect($result)->toEqual('<pre><code class="hljs php"><span class="hljs-meta">&lt;?php</span> phpinfo()</code></pre>');
});

test('codeBlockHighlight uses the configured languageClassPrefix', function () {
    $html = '<pre><code class="foo php">&lt;?php phpinfo()</code></pre>';

    $result = (new Editor([
            'extensions' => [
                new StarterKit([
                    'codeBlock' => false,
                ]),
                new CodeBlockHighlight([
                    'languageClassPrefix' => 'foo ',
                ]),
            ],
        ]))
        ->setContent($html)
        ->getHTML();

    expect($result)->toEqual('<pre><code class="foo php"><span class="hljs-meta">&lt;?php</span> phpinfo()</code></pre>');
});

test('codeBlockHighlight falls back to just a pre and code tag', function () {
    $html = '<pre><code class="WRONG PREFIX php">&lt;?php phpinfo()</code></pre>';

    $result = (new Editor([
            'extensions' => [
                new StarterKit([
                    'codeBlock' => false,
                ]),
                new CodeBlockHighlight(),
            ],
        ]))
        ->setContent($html)
        ->getHTML();

    expect($result)->toEqual('<pre><code>&lt;?php phpinfo()</code></pre>');
});
