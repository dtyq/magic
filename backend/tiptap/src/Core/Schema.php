<?php

namespace Tiptap\Core;

class Schema
{
    public array $allExtensions = [];

    public array $nodes = [];
    public array $marks = [];
    public array $extensions = [];

    public $defaultNode;
    public $topNode;

    public array $globalAttributes = [];

    public function __construct(array $extensions = [])
    {
        $this->allExtensions = $this->loadExtensions($extensions);
        usort($this->allExtensions, fn ($a, $b) => $b::$priority - $a::$priority);

        $this->nodes = array_filter($this->allExtensions, function ($extension) {
            return is_subclass_of($extension, \Tiptap\Core\Node::class);
        });

        $this->marks = array_filter($this->allExtensions, function ($extension) {
            return is_subclass_of($extension, \Tiptap\Core\Mark::class);
        });

        $this->extensions = array_filter($this->allExtensions, function ($extension) {
            return is_subclass_of($extension, \Tiptap\Core\Extension::class);
        });

        $this->defaultNode = reset($this->nodes);
        $this->topNode = current(array_filter($this->nodes, fn ($node) => $node::$topNode));
    }

    private function loadExtensions($extensions = [])
    {
        foreach ($extensions as $extension) {
            if (method_exists($extension, 'addExtensions') && count($extension->addExtensions())) {
                $extensions = array_merge(
                    $extensions,
                    $this->loadExtensions($extension->addExtensions()),
                );
            }

            if (method_exists($extension, 'addGlobalAttributes')) {
                $globalAttributes = $extension->addGlobalAttributes();

                foreach ($globalAttributes as $globalAttributeConfiguration) {
                    foreach ($globalAttributeConfiguration['types'] ?? [] as $type) {
                        $this->globalAttributes[$type] = array_merge(
                            $this->globalAttributes[$type] ?? [],
                            $globalAttributeConfiguration['attributes']
                        );
                    }
                }
            }
        }

        return $extensions;
    }

    public function apply($document)
    {
        if (! is_array($document['content'])) {
            return $document;
        }

        $document['content'] = array_map(function ($node) {
            foreach ($this->allExtensions as $extension) {
                if (! isset($node['type']) || $node['type'] !== $extension::$name) {
                    continue;
                }

                if (property_exists($extension, 'marks')) {
                    if ($extension::$marks === '') {
                        $node = $this->filterMarks($node);

                        unset($node['marks']);
                    }

                    // TODO: Support for multiple marks is missing
                }

                break;
            }

            return $node;
        }, $document['content']);

        return $document;
    }

    public function filterMarks(&$node)
    {
        unset($node['marks']);

        if (isset($node['content'])) {
            $node['content'] = array_map(function ($child) {
                return $this->filterMarks($child);
            }, $node['content']);
        }

        return $node;
    }

    public function getAttributeConfigurations($class): array
    {
        return array_merge(
            $this->globalAttributes[$class::$name] ?? [],
            $class->addAttributes(),
        );
    }
}
