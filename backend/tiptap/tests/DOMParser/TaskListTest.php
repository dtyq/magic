<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\TaskItem;
use Tiptap\Nodes\TaskList;

test('task list gets parsed correctly', function () {
    $html = '<ul data-type="taskList"><li data-type="taskItem"><p>Example Text</p></li></ul>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit(),
            new TaskList(),
            new TaskItem(),
        ],
    ]))->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'taskList',
                'content' => [
                    [
                        'type' => 'taskItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'Example Text',
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

test('bullet lists are still parsed correctly', function () {
    $html = '<ul><li><p>Example Text</p></li></ul>';

    $result = (new Editor([
        'extensions' => [
            new StarterKit(),
            new TaskList(),
            new TaskItem(),
        ],
    ]))->setContent($html)->getDocument();

    expect($result)->toEqual([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'bulletList',
                'content' => [
                    [
                        'type' => 'listItem',
                        'content' => [
                            [
                                'type' => 'paragraph',
                                'content' => [
                                    [
                                        'type' => 'text',
                                        'text' => 'Example Text',
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
