<?php

use Tiptap\Core\Schema;
use Tiptap\Extensions\StarterKit;

test('paragraph is the default node', function () {
    $schema = new Schema([
        new StarterKit,
    ]);

    expect($schema->defaultNode::$name)->toEqual('paragraph');
});
