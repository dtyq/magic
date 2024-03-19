<?php

namespace Tiptap\Core;

class JSONSerializer
{
    protected $document;

    public function process(array $value): string
    {
        $this->document = json_decode(json_encode($value));

        return json_encode($this->document);
    }
}
