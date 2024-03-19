<?php

namespace Tiptap\Tests\Marks;

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Superscript;

test('superscript mark gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Example Text',
                'marks' => [
                    [
                        'type' => 'superscript',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Superscript,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<sup>Example Text</sup>');
});
