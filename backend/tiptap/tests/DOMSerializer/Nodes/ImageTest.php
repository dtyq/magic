<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\Image;

test('image node gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'image',
                'attrs' => [
                    'alt' => 'an image',
                    'src' => 'image/source',
                    'title' => 'The image title',
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Image,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<img src="image/source" alt="an image" title="The image title">');
});
