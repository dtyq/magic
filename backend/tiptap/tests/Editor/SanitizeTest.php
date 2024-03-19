<?php

use Tiptap\Editor;

test('unknown nodes are removed from the document', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'foo',
                'content' => [
                    [
                        'type' => 'foo',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'foo',
                'content' => [
                    [
                        'type' => 'foo',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ]);
});


test('unknown nodes are removed from the document with the sanitized method', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'foo',
                'content' => [
                    [
                        'type' => 'foo',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)->sanitize($document);

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'foo',
                'content' => [
                    [
                        'type' => 'foo',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ]);
});

test('unknown HTML tags are removed', function () {
    $document = '<p>Example Text<script>alert("HACKED");</script></p>';

    $result = (new Editor)->setContent($document)->getHTML();

    expect($result)->toEqual('<p>Example Text</p>');
});

test('unknown HTML tags are removed with the sanitize method', function () {
    $document = '<p>Example Text<script>alert("HACKED");</script></p>';

    $result = (new Editor)->sanitize($document);

    expect($result)->toEqual('<p>Example Text</p>');
});

test('unknown nodes are removed from the JSON', function () {
    $document = json_encode([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'foo',
                'content' => [
                    [
                        'type' => 'foo',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ]);

    $result = (new Editor)
        ->setContent($document)
        ->getJSON();

    expect($result)->toEqual(json_encode([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'foo',
                'content' => [
                    [
                        'type' => 'foo',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ]));
});

test('unknown nodes are removed from the json with the sanitized method', function () {
    $document = json_encode([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'foo',
                'content' => [
                    [
                        'type' => 'foo',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ]);

    $result = (new Editor)->sanitize($document);

    expect($result)->toEqual(json_encode([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'foo',
                'content' => [
                    [
                        'type' => 'foo',
                        'text' => 'Example Text',
                    ],
                ],
            ],
        ],
    ]));
});
