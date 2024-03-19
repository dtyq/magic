<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\Mention;

test('user mention gets rendered correctly', function () {
    $html = '<p>Hey <span data-type="mention" data-id="123"></span>, was geht?</p>';

    $output = (new Editor([
        'extensions' => [
            new StarterKit,
            new Mention,
        ],
    ]))->setContent($html)->getDocument();

    expect($output)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => 'Hey ',
                    ],
                    [
                        'type' => 'mention',
                        'attrs' => [
                            'id' => 123,
                        ],
                    ],
                    [
                        'type' => 'text',
                        'text' => ', was geht?',
                    ],
                ],
            ],
        ],
    ]);
});
