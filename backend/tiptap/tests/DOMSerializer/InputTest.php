<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\Image;

test('array gets rendered to html', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Example Text',
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('Example Text');
});

test('json gets rendered to html', function () {
    $document = json_encode([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Example Text',
            ],
        ],
    ]);

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('Example Text');
});

test('encoding is correct', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Äffchen',
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('Äffchen');
});

test('quotes are not escaped', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => '"Example Text"',
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('&quot;Example Text&quot;');
});

test('escaped attribute values', function () {
    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Image,
        ],
    ]))->setContent([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'image',
                'attrs' => [
                    'src' => '"><script type="text/javascript">alert(1);</script><img src="',
                ],
            ],
        ],
    ])->getHTML();

    expect($result)->toEqual('<img src="&quot;&gt;&lt;script type=&quot;text/javascript&quot;&gt;alert(1);&lt;/script&gt;&lt;img src=&quot;">');
});

test('reasonable attribute names', function () {
    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Image,
        ],
    ]))->setContent([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'image',
                'attrs' => [
                    'onerror' => 'alert(1)',
                    'src' => '',
                ],
            ],
        ],
    ])->getHTML();

    expect($result)->toEqual('<img>');
});
