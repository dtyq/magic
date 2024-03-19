<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Parser\Function;

use ArrayAccess;
use Countable;
use InvalidArgumentException;
use RuntimeException;
use SeekableIterator;
use Serializable;

/**
 * Tokenizer.
 *
 * The Tokenizer is an object-oriented abstraction for the token_get_all() function. It normalizes all of the tokens
 * into Token objects and allows iteration and seeking through the collection of tokens.
 *
 * @license MIT
 * @see https://github.com/jeremeamia/FunctionParser
 */
class Tokenizer implements SeekableIterator, Countable, ArrayAccess, Serializable
{
    /**
     * @var array the array of tokens
     */
    protected $tokens;

    /**
     * @var int the current index of the iterator through the tokens
     */
    protected $index;

    /**
     * Constructs a Tokenizer object.
     *
     * @param array|string $code the code to tokenize, or an array of Token objects
     * @throws InvalidArgumentException
     */
    public function __construct($code)
    {
        if (! function_exists('token_get_all')) {
            // @codeCoverageIgnoreStart
            throw new RuntimeException('The PHP tokenizer must be enabled to use this class.');
            // @codeCoverageIgnoreEnd
        }

        if (is_string($code)) {
            $code = trim($code);

            // Add a php opening tag if not already included
            if (strpos($code, '<?php') !== 0) {
                $code = "<?php\n" . $code;
            }

            // Get the tokens using the PHP tokenizer and then convert them to normalized Token objects
            $this->tokens = array_map(function ($token) {
                return new Token($token);
            }, token_get_all($code));

            // Remove the PHP opening tag token
            array_shift($this->tokens);
        } elseif (is_array($code) && isset($code[0]) && $code[0] instanceof Token) {
            $this->tokens = $code;
        } else {
            throw new InvalidArgumentException('The tokenizer either expects a string of code or an array of Tokens.');
        }

        $this->index = 0;
    }

    public function __serialize()
    {
        return $this->serialize();
    }

    public function __unserialize($data): void
    {
        $this->unserialize($data);
    }

    /**
     * Returns a tokenizer as a string of code.
     *
     * @return string the string of code
     */
    public function __toString()
    {
        return $this->asString();
    }

    /**
     * Move to the next token and return it. Returns null if there are no more tokens.
     *
     * @return Token the next token in the tokenizer
     */
    public function getNextToken()
    {
        $this->next();

        return $this->valid() ? $this->current() : null;
    }

    /**
     * Move to the previous token and return it. Returns null if there are no more tokens.
     *
     * @return Token the previous token in the tokenizer
     */
    public function getPreviousToken()
    {
        $this->prev();

        return $this->valid() ? $this->current() : null;
    }

    /**
     * Determines whether or not there are more tokens left.
     *
     * @return bool true if there are more tokens left in the tokenizer
     */
    public function hasMoreTokens()
    {
        return $this->index < $this->count() - 1;
    }

    /**
     * Find a token in the tokenizer. You can search by the token's literal code or name. You can also specify on
     * offset for the search. If the offset is negative, the search will be done starting from the end.
     *
     * @param int|string $search the token's literal code or name
     * @param int $offset The offset to start searching from. A negative offest searches from the end.
     * @return bool|int the index of the token that has been found or false
     */
    public function findToken($search, $offset = 0)
    {
        if ($search === null) {
            throw new InvalidArgumentException('A token cannot be searched for with a null value.');
        }
        if (! is_int($offset)) {
            throw new InvalidArgumentException('On offset must be specified as an integer.');
        }

        if ($offset >= 0) {
            // Offset is greater than zero. Search from left to right
            $tokenizer = clone $this;
            $is_reversed = false;
        } else {
            // Offset is negative. Search from right to left
            $tokenizer = new Tokenizer(array_reverse($this->tokens));
            $offset = abs($offset) - 1;
            $is_reversed = true;
        }

        // Seek to the offset and start the search from there
        $tokenizer->seek($offset);

        // Loop through the tokens and search for the target token
        while ($tokenizer->valid()) {
            $token = $tokenizer->current();

            if ($token->code === $search || $token->name === $search || $token->value === $search) {
                $index = $tokenizer->key();

                // Calculate the index as if the tokenizer is not reversed
                if ($is_reversed) {
                    $index = count($tokenizer) - $index - 1;
                }

                return $index;
            }

            $tokenizer->next();
        }

        return false;
    }

    /**
     * Determines whether or not a token is in the tokenizer. Searches by literal token code or name.
     *
     * @param int|string $search the token's literal code or name
     * @return bool Whether or not the token is in the tokenizer
     */
    public function hasToken($search)
    {
        return (bool) $this->findToken($search);
    }

    /**
     * Returns a new tokenizer that consists of a subset of the tokens specified by the provided range.
     *
     * @param int $start The starting offset of the range
     * @param int $finish The ending offset of the range
     * @return Tokenizer A tokenizer with a subset of tokens
     */
    public function getTokenRange($start, $finish)
    {
        $tokens = array_slice($this->tokens, (int) $start, (int) $finish - (int) $start);

        return new Tokenizer($tokens);
    }

    /**
     * Prepends a tokenizer to the beginning of this tokenizer.
     *
     * @param Tokenizer $new_tokens the tokenizer to prepend
     * @return Tokenizer
     */
    public function prependTokens(Tokenizer $new_tokens)
    {
        $this->tokens = array_merge($new_tokens->asArray(), $this->tokens);
        $this->rewind();

        return $this;
    }

    /**
     * Appends a tokenizer to the beginning of this tokenizer.
     *
     * @param Tokenizer $new_tokens the tokenizer to append
     * @return Tokenizer
     */
    public function appendTokens(Tokenizer $new_tokens)
    {
        $this->tokens = array_merge($this->tokens, $new_tokens->asArray());
        $this->rewind();

        return $this;
    }

    /**
     * Get the first token.
     *
     * @return Token the first token
     */
    public function getFirst()
    {
        $this->index = 0;

        return $this->current();
    }

    /**
     * Get the last token.
     *
     * @return Token the last token
     */
    public function getLast()
    {
        $this->index = $this->count() - 1;

        return $this->current();
    }

    /**
     * Returns the current token.
     *
     * @return Token the current token
     */
    public function current(): mixed
    {
        return $this->tokens[$this->index];
    }

    /**
     * Move to the next token.
     */
    public function next(): void
    {
        ++$this->index;
    }

    /**
     * Move to the previous token.
     */
    public function prev()
    {
        --$this->index;
    }

    /**
     * Return the current token's index.
     *
     * @return int the token's index
     */
    public function key(): int
    {
        return $this->index;
    }

    /**
     * Determines whether or not the tokenizer's index points to a token.
     *
     * @return bool true if the current token exists
     */
    public function valid(): bool
    {
        return array_key_exists($this->index, $this->tokens);
    }

    /**
     * Move to the first token.
     */
    public function rewind(): void
    {
        $this->index = 0;
    }

    /**
     * Move to the specified token.
     *
     * @param int $index the index to seek to
     */
    public function seek($index): void
    {
        $this->index = (int) $index;
    }

    /**
     * Determines wheter or not the specified offset exists.
     *
     * @param int $offset the offset to check
     * @return bool whether or not the offset exists
     */
    public function offsetExists($offset): bool
    {
        return is_integer($offset) && array_key_exists($offset, $this->tokens);
    }

    /**
     * Gets the token at the specified offset.
     *
     * @param int $offset the offset to get
     * @return Token the token at the offset
     */
    public function offsetGet($offset): mixed
    {
        return $this->tokens[$offset];
    }

    /**
     * Sets the token at the specified offset.
     *
     * @param int $offset the offset to set
     * @param Token the token to set
     * @param mixed $value
     * @throws InvalidArgumentException
     */
    public function offsetSet($offset, $value): void
    {
        if (! (is_integer($offset) && $offset >= 0 && $offset <= $this->count())) {
            throw new InvalidArgumentException('The offset must be a valid, positive integer.');
        }

        if (! $value instanceof Token) {
            throw new InvalidArgumentException('The value provided must be a token.');
        }

        $this->tokens[$offset] = $value;
    }

    /**
     * Unsets the token at the specified offset.
     *
     * @param int $offset the offset to unset
     */
    public function offsetUnset($offset): void
    {
        if ($this->offsetExists($offset)) {
            unset($this->tokens[$offset]);

            // Re-index the tokens
            $this->tokens = array_values($this->tokens);

            // If the current index is now outside of the valid indeces, reset the index
            if (! $this->valid()) {
                $this->rewind();
            }
        }
    }

    /**
     * Get the number of tokens in the tokenizer.
     *
     * @return int the number of tokens
     */
    public function count(): int
    {
        return count($this->tokens);
    }

    /**
     * Serializes the tokenizer.
     *
     * @return string the serialized tokenizer
     */
    public function serialize()
    {
        return serialize([
            'tokens' => $this->tokens,
            'index' => $this->index,
        ]);
    }

    /**
     * Unserialize the tokenizer.
     *
     * @param string $serialized the serialized tokenizer
     */
    public function unserialize($serialized)
    {
        $unserialized = unserialize($serialized);
        $this->__construct($unserialized['tokens']);
        $this->seek($unserialized['index']);
    }

    /**
     * Gets the tokens as an array from the tokenizer.
     *
     * @return array the array of tokens
     */
    public function asArray()
    {
        return $this->tokens;
    }

    /**
     * Returns a tokenizer as a string of code.
     *
     * @return string the string of code
     */
    public function asString()
    {
        $code = '';

        foreach ($this->tokens as $token) {
            $code .= $token;
        }

        return $code;
    }
}
