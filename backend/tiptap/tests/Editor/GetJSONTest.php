<?php

use Tiptap\Editor;

test('getJSON() returns JSON', function () {
    $html = "<p>Example</p>";

    $result = (new Editor)
        ->setContent($html)
        ->getJSON();

    expect($result)->toEqual('{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Example"}]}]}');
});
