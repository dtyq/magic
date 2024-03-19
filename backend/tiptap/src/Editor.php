<?php

namespace Tiptap;

use Exception;
use Tiptap\Core\DOMParser;
use Tiptap\Core\DOMSerializer;
use Tiptap\Core\JSONSerializer;
use Tiptap\Core\Schema;
use Tiptap\Core\TextSerializer;
use Tiptap\Extensions\StarterKit;

class Editor
{
    protected $document;

    public $schema;

    public $configuration = [
        'content' => null,
        'extensions' => [],
    ];

    public function __construct(array $configuration = [])
    {
        if (! isset($configuration['extensions'])) {
            $configuration['extensions'] = [
                new StarterKit,
            ];
        }

        $this->configuration = array_merge_recursive($this->configuration, $configuration);
        $this->schema = new Schema($this->configuration['extensions']);

        if (isset($configuration['content'])) {
            $this->setContent($configuration['content']);
        }
    }

    /**
     * @return static
     */
    public function setContent($value): self
    {
        if ($this->getContentType($value) === 'HTML') {
            $this->document = (new DOMParser($this->schema))->process($value);
        } elseif ($this->getContentType($value) === 'Array') {
            $this->document = json_decode(json_encode($value), true);
        } elseif ($this->getContentType($value) === 'JSON') {
            $this->document = json_decode($value, true);
        }

        $this->document = $this->schema->apply($this->document);

        return $this;
    }

    public function getDocument()
    {
        return $this->document;
    }

    public function getJSON(): string
    {
        return (new JSONSerializer)->process($this->document);
    }

    public function getHTML(): string
    {
        return (new DOMSerializer($this->schema))->process($this->document);
    }

    public function getText($configuration = []): string
    {
        return (new TextSerializer($this->schema, $configuration))->process($this->document);
    }

    public function sanitize($value)
    {
        if ($this->getContentType($value) === 'HTML') {
            return $this->setContent($value)->getHTML();
        } elseif ($this->getContentType($value) === 'Array') {
            return $this->setContent($value)->getDocument();
        } elseif ($this->getContentType($value) === 'JSON') {
            return $this->setContent($value)->getJSON();
        }
    }

    public function getContentType($value): string
    {
        if (is_string($value)) {
            try {
                /**
                 * @psalm-suppress UnusedFunctionCall
                 */
                json_decode($value, true, 512, JSON_THROW_ON_ERROR);

                return 'JSON';
            } catch (Exception $exception) {
                return 'HTML';
            }
        }

        if (is_array($value)) {
            return 'Array';
        }

        throw new Exception('Unknown format passed to setContent(). Try passing HTML, JSON or an Array.');
    }

    public function descendants($closure): Editor
    {
        // Transform the document to an object
        $node = json_decode(json_encode($this->document));

        $this->walkThroughNodes($node, $closure);

        // Store the updated document.
        $this->setContent(json_decode(json_encode($node), true));

        return $this;
    }

    /**
     * @return void
     */
    private function walkThroughNodes(&$node, $closure)
    {
        // Skip, if it’s just text.
        if ($node->type === 'text') {
            return;
        }

        // Call the closure.
        $closure($node);

        // Skip, if there are no children.
        if (! isset($node->content)) {
            return;
        }

        // Make sure content is an Array.
        $content = is_array($node->content) ? $node->content : [];

        // Loop through all children.
        foreach ($content as $child) {
            $this->walkThroughNodes($child, $closure);
        }
    }
}
