<?php

namespace Tiptap\Tests\HTMLOutput\Mix;

use Tiptap\Editor;

test('multiple marks get rendered correctly', function () {
    $document = [
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
                                'type' => 'bold',
                            ],
                            [
                                'type' => 'italic',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)->setContent($document)->getHTML();
    expect($result)->toEqual('<p><strong><em>Example Text</em></strong></p>');
});


test('multiple marks get rendered correctly, with additional mark at the first node', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'marks' => [
                    [
                        'type' => 'italic',
                    ],
                    [
                        'type' => 'bold',
                    ],
                ],
                'text' => 'lorem ',
            ],
            [
                'type' => 'text',
                'marks' => [
                    [
                        'type' => 'bold',
                    ],
                ],
                'text' => 'ipsum',
            ],
        ],
    ];
    $result = (new Editor)->setContent($document)->getHTML();

    expect($result)->toEqual('<em><strong>lorem </strong></em><strong>ipsum</strong>');
});


test('multiple marks get rendered correctly, with additional mark at the last node', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'marks' => [
                    [
                        'type' => 'italic',
                    ],
                ],
                'text' => 'lorem ',
            ],
            [
                'type' => 'text',
                'marks' => [
                    [
                        'type' => 'italic',
                    ],
                    [
                        'type' => 'bold',
                    ],
                ],
                'text' => 'ipsum',
            ],
        ],
    ];
    $result = (new Editor)->setContent($document)->getHTML();

    expect($result)->toEqual('<em>lorem <strong>ipsum</strong></em>');
});


test('multiple marks get rendered correctly, when overlapping marks exist', function () {
    $document = [
        "type" => "doc",
        "content" => [
            [
                "type" => "paragraph",
                "content" => [
                    [
                        "type" => "text",
                        "marks" => [
                            [
                                "type" => "bold",
                            ],
                        ],
                        "text" => "lorem ",
                    ],
                    [
                        "type" => "text",
                        "marks" => [
                            [
                                "type" => "bold",
                            ],
                            [
                                "type" => "italic",
                            ],
                        ],
                        "text" => "ipsum",
                    ],
                    [
                        "type" => "text",
                        "marks" => [
                            [
                                "type" => "italic",
                            ],
                        ],
                        "text" => " dolor",
                    ],
                    [
                        "type" => "text",
                        "text" => " sit",
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<p><strong>lorem <em>ipsum</em></strong><em> dolor</em> sit</p>');
});


test('multiple marks get rendered correctly, when overlapping passage with multiple marks exist', function () {
    $document = [
        "type" => "doc",
        "content" => [
            [
                "type" => "paragraph",
                "content" => [
                    [
                        "type" => "text",
                        "marks" => [
                            [
                                "type" => "bold",
                            ],
                            [
                                "type" => "strike",
                            ],
                        ],
                        "text" => "lorem ",
                    ],
                    [
                        "type" => "text",
                        "marks" => [
                            [
                                "type" => "italic",
                            ],
                            [
                                "type" => "bold",
                            ],
                            [
                                "type" => "strike",
                            ],
                        ],
                        "text" => "ipsum",
                    ],
                    [
                        "type" => "text",
                        "marks" => [
                            [
                                "type" => "strike",
                            ],
                            [
                                "type" => "italic",
                            ],
                        ],
                        "text" => " dolor",
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor)
        ->setContent($document)
        ->getHTML();

    expect($result)->toEqual('<p><strong><strike>lorem <em>ipsum</em></strike></strong><strike><em> dolor</em></strike></p>');
});
