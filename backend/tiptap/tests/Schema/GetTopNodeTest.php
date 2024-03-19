<?php

use Tiptap\Core\Schema;
use Tiptap\Extensions\StarterKit;

test('document is the top node', function () {
    $schema = new Schema([
        new StarterKit,
    ]);

    expect($schema->topNode::$name)->toEqual('doc');
});
