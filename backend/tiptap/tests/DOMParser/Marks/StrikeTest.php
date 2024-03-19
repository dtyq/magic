<?php

use Tiptap\Editor;

test('strike and s del get rendered correctly', function () {
    $html = '<p><strike>Example text using strike</strike> and <s>example text using s</s> and <del>example text using del</del></p>';

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
                        'text' => 'Example text using strike',
                        'marks' => [
                            [
                                'type' => 'strike',
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ' and ',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'example text using s',
                        'marks' => [
                            [
                                'type' => 'strike',
                            ],
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ' and ',
                    ],
                    [
                        'type' => 'text',
                        'text' => 'example text using del',
                        'marks' => [
                            [
                                'type' => 'strike',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});

test('inline style is parsed correctly', function () {
    $html = '<p><span style="text-decoration: line-through">Example Text</span></p>';

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
                                'type' => 'strike',
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});
