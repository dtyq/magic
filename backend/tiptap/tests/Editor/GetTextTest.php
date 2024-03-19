<?php

use Tiptap\Editor;

test('getText() returns plain text', function () {
    $html = "<h1>Heading</h1><p>Paragraph</p>";

    $result = (new Editor)
        ->setContent($html)
        ->getText();

    expect($result)->toEqual("Heading\n\nParagraph");
});

test('getText() only returns one blockSeparator between blocks', function () {
    $html = "<h1>Heading</h1><p>Paragraph</p><ul><li><p>ListItem</p></li></ul>";

    $result = (new Editor)
        ->setContent($html)
        ->getText();

    expect($result)->toEqual("Heading\n\nParagraph\n\nListItem");
});

test('the blockSeparator is configureable', function () {
    $html = "<h1>Heading</h1><p>Paragraph</p>";

    $result = (new Editor)
        ->setContent($html)
        ->getText([
            'blockSeparator' => "\n",
        ]);

    expect($result)->toEqual("Heading\nParagraph");
});
