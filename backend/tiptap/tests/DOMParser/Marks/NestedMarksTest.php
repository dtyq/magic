<?php

use Tiptap\Editor;

test('nested marks are rendered correctly', function () {
    $html = '<strong>only bold <em>bold and italic</em> only bold</strong>';

    $result = (new Editor)
        ->setContent($html)
        ->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'text',
                'text' => 'only bold ',
                'marks' => [
                    [
                        'type' => 'bold',
                    ],
                ],
            ],
            [
                'type' => 'text',
                'text' => 'bold and italic',
                'marks' => [
                    [
                        'type' => 'bold',
                    ],
                    [
                        'type' => 'italic',
                    ],
                ],
            ],
            [
                'type' => 'text',
                'text' => ' only bold',
                'marks' => [
                    [
                        'type' => 'bold',
                    ],
                ],
            ],
        ],
    ]);
});
