<?php

use Tiptap\Editor;

test('multiple marks are rendered correctly', function () {
    $html = '<p><strong><em>Example Text</em></strong></p>';

    $result = (new Editor)->setContent($html)->getDocument();

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
    ]);
});
