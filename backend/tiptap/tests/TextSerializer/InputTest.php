<?php

use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Nodes\Image;

test('escaped attribute values', function () {
    $result = (new Editor([
        'extensions' => [
            new StarterKit,
            new Image,
        ],
    ]))->setContent([
        'type' => 'doc',
        'content' => [
            [
                'type' => 'image',
                'attrs' => [
                    'src' => '"><script type="text/javascript">alert(1);</script><img src="',
                ],
            ],
        ],
    ])->getHTML();

    expect($result)->toEqual('<img src="&quot;&gt;&lt;script type=&quot;text/javascript&quot;&gt;alert(1);&lt;/script&gt;&lt;img src=&quot;">');
});
