<?php

use Tiptap\Editor;

test('heading node gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => 2,
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Headline',
                    ],
                ],
            ],
        ],
    ];

    $html = '<h2>Example Headline</h2>';

    expect((new Editor)->setContent($document)->getHTML())->toEndWith($html);
});

test('forbidden heading levels are transformed to a heading with an allowed level', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => 7,
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Headline',
                    ],
                ],
            ],
        ],
    ];

    $html = '<h1>Example Headline</h1>';

    expect((new Editor)->setContent($document)->getHTML())->toEqual($html);
});

test('depending on the configuration heading levels are allowed', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => 3,
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Headline',
                    ],
                ],
            ],
        ],
    ];

    $html = '<h3>Example Headline</h3>';

    expect((new Editor([
        'extensions' => [
            new \Tiptap\Nodes\Heading(['levels' => [1, 2, 3]]),
        ],
    ]))->setContent($document)->getHTML())->toEqual($html);
});

test('depending on the configuration heading levels are transformed', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => 4,
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Headline',
                    ],
                ],
            ],
        ],
    ];

    $html = '<h1>Example Headline</h1>';

    expect((new Editor([
        'extensions' => [
            new \Tiptap\Nodes\Heading(['levels' => [1, 2, 3]]),
        ],
    ]))->setContent($document)->getHTML())->toEqual($html);
});

test('configured HTMLAttributes are rendered to HTML', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => 1,
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Headline',
                    ],
                ],
            ],
        ],
    ];

    $html = '<h1 class="custom-heading-class">Example Headline</h1>';

    expect((new Editor([
        'extensions' => [
            new \Tiptap\Nodes\Heading(['HTMLAttributes' => [
                'class' => 'custom-heading-class',
            ]]),
        ],
    ]))->setContent($document)->getHTML())->toEqual($html);
});

test('custom attributes are rendered too', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => 1,
                    'color' => 'red',
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Headline',
                    ],
                ],
            ],
        ],
    ];

    $html = '<h1 class="custom-heading-class" style="color: red;">Example Headline</h1>';

    class CustomHeading extends \Tiptap\Nodes\Heading
    {
        public function addAttributes()
        {
            return [
                'color' => [
                    'renderHTML' => function ($attributes) {
                        if (! isset($attributes->color)) {
                            return null;
                        }

                        return [
                            'style' => "color: {$attributes->color}",
                        ];
                    },
                ],
            ];
        }
    }

    $result = (new Editor([
        'extensions' => [
            new CustomHeading([
                'HTMLAttributes' => [
                    'class' => 'custom-heading-class',
                ],
            ]),
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual($html);
});

test('inline styles are merged properly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'heading',
                'attrs' => [
                    'level' => 1,
                    'color' => 'red',
                ],
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Example Headline',
                    ],
                ],
            ],
        ],
    ];

    $html = '<h1 style="color: white; background-color: red;">Example Headline</h1>';

    class AnotherCustomHeading extends \Tiptap\Nodes\Heading
    {
        public function addAttributes()
        {
            return [
                'color' => [
                    'renderHTML' => function ($attributes) {
                        if (! isset($attributes->color)) {
                            return null;
                        }

                        return [
                            'style' => "background-color: {$attributes->color}",
                        ];
                    },
                ],
            ];
        }
    }

    $result = (new Editor([
        'extensions' => [
            new AnotherCustomHeading([
                'HTMLAttributes' => [
                    'style' => 'color: white; ',
                ],
            ]),
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual($html);
});
