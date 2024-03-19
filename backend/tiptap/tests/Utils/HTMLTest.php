<?php

use Tiptap\Utils\HTML;

test('classes are merged properly', function () {
    $attributes = [
        ['class' => 'a'],
        ['class' => 'b'],
    ];

    $result = HTML::mergeAttributes(...$attributes);

    expect($result)->toEqual(['class' => 'a b']);
});
