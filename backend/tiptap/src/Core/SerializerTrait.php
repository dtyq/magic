<?php

namespace Tiptap\Core;


trait SerializerTrait
{
    private function isMarkOrNode($markOrNode, $renderClass): bool
    {
        return isset($markOrNode->type) && $markOrNode->type === $renderClass::$name;
    }
}
