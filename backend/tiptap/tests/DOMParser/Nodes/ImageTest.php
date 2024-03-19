<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\Image;

test('image gets rendered correctly', function () {
    $html = '<img src="https://example.com/eggs.png" alt="The Finished Dish" title="Eggs in a dish" />';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Image,
        ],
    ]))->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'image',
                'attrs' => [
                    'alt' => 'The Finished Dish',
                    'src' => 'https://example.com/eggs.png',
                    'title' => 'Eggs in a dish',
                ],
            ],
        ],
    ]);
});

test('image gets rendered correctly when title is missing', function () {
    $html = '<img src="https://example.com/eggs.png" alt="The Finished Dish" />';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Image,
        ],
    ]))->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'image',
                'attrs' => [
                    'alt' => 'The Finished Dish',
                    'src' => 'https://example.com/eggs.png',
                ],
            ],
        ],
    ]);
});

test('image gets rendered correctly when alt is missing', function () {
    $html = '<img src="https://example.com/eggs.png" title="Eggs in a dish" />';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Image,
        ],
    ]))->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'image',
                'attrs' => [
                    'src' => 'https://example.com/eggs.png',
                    'title' => 'Eggs in a dish',
                ],
            ],
        ],
    ]);
});
