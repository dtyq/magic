<?php

namespace Tiptap\Tests\Marks;

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Underline;

test('underline mark gets rendered correctly', function () {
    $document = [
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'Example Text',
                'marks' => [
                    [
                        'type' => 'underline',
                    ],
                ],
            ],
        ],
    ];

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Underline,
        ],
    ]))->setContent($document)->getHTML();

    expect($result)->toEqual('<u>Example Text</u>');
});
