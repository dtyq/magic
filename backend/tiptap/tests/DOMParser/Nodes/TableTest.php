<?php

namespace Tiptap\Tests\JSONOutput\Nodes;

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\Table;
use Tiptap\Nodes\TableCell;
use Tiptap\Nodes\TableHeader;
use Tiptap\Nodes\TableRow;

test('table gets rendered correctly', function () {
    $html =
        '<table><tbody>' .
            '<tr>' .
                '<th><p>text in header cell</p></th>' .
                '<th colspan="2" data-colwidth="100,0"><p>text in header cell with colspan 2</p></th>' .
            '</tr>' .
            '<tr>' .
                '<td rowspan="2"><p>paragraph 1 in cell with rowspan 2</p><p>paragraph 2 in cell with rowspan 2</p></td>' .
                '<td><p>foo</p></td>' .
                '<td><p>bar</p></td>' .
            '</tr>' .
            '<tr>' .
                '<td><p>foo</p></td>' .
                '<td><p>bar</p></td>' .
            '</tr>' .
        '</tbody></table>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Table,
            new TableRow,
            new TableCell,
            new TableHeader,
        ],
    ]))->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'table',
                'content' => [
                    [
                        'type' => 'tableRow',
                        'content' => [
                            [
                                'type' => 'tableHeader',
                                'content' => [
                                    [
                                        'type' => 'paragraph',
                                        'content' => [
                                            [
                                                'type' => 'text',
                                                'text' => 'text in header cell',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                            [
                                'type' => 'tableHeader',
                                'attrs' => [
                                    'colspan' => 2,
                                    'colwidth' => [
                                        100,
                                        0,
                                    ],
                                ],
                                'content' => [
                                    [
                                        'type' => 'paragraph',
                                        'content' => [
                                            [
                                                'type' => 'text',
                                                'text' => 'text in header cell with colspan 2',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'tableRow',
                        'content' => [
                            [
                                'type' => 'tableCell',
                                'attrs' => [
                                    'rowspan' => 2,
                                ],
                                'content' => [
                                    [
                                        'type' => 'paragraph',
                                        'content' => [
                                            [
                                                'type' => 'text',
                                                'text' => 'paragraph 1 in cell with rowspan 2',
                                            ],
                                        ],
                                    ],
                                    [
                                        'type' => 'paragraph',
                                        'content' => [
                                            [
                                                'type' => 'text',
                                                'text' => 'paragraph 2 in cell with rowspan 2',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                            [
                                'type' => 'tableCell',
                                'content' => [
                                    [
                                        'type' => 'paragraph',
                                        'content' => [
                                            [
                                                'type' => 'text',
                                                'text' => 'foo',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                            [
                                'type' => 'tableCell',
                                'content' => [
                                    [
                                        'type' => 'paragraph',
                                        'content' => [
                                            [
                                                'type' => 'text',
                                                'text' => 'bar',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'tableRow',
                        'content' => [
                            [
                                'type' => 'tableCell',
                                'content' => [
                                    [
                                        'type' => 'paragraph',
                                        'content' => [
                                            [
                                                'type' => 'text',
                                                'text' => 'foo',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                            [
                                'type' => 'tableCell',
                                'content' => [
                                    [
                                        'type' => 'paragraph',
                                        'content' => [
                                            [
                                                'type' => 'text',
                                                'text' => 'bar',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ]);
});
