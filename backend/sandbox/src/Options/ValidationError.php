<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox\Options;

use PhpParser\Node;
use PHPSandbox\Error;
use Throwable;

class ValidationError
{
    /**
     * @var null|callable Callable that handles any thrown validation errors when set
     */
    protected $validation_error_handler;

    /**
     * @var null|Throwable The last validation error thrown by the sandbox
     */
    protected ?Throwable $last_validation_error = null;

    /** Gets the last validation error thrown by the sandbox.
     */
    public function getLastValidationError(): ?Throwable
    {
        return $this->last_validation_error;
    }

    /** Get validation error handler.
     *
     * This function returns the sandbox validation error handler.
     */
    public function getValidationErrorHandler(): ?callable
    {
        return $this->validation_error_handler;
    }

    /** Set callable to handle thrown validation Errors.
     *
     * This function sets the sandbox validation Error handler. The handler accepts the thrown Error and the sandbox
     * instance as arguments. If the error handler does not handle validation errors correctly then the sandbox's
     * security may become compromised!
     *
     * @param null|callable $handler Callable to handle thrown validation Errors
     *
     * Returns the PHPSandbox instance for fluent querying
     */
    public function setValidationErrorHandler(?callable $handler): self
    {
        $this->validation_error_handler = $handler;
        return $this;
    }

    /** Unset validation error handler.
     *
     * This function unsets the sandbox validation error handler.
     *
     * Returns the PHPSandbox instance for fluent querying
     */
    public function unsetValidationErrorHandler(): self
    {
        $this->validation_error_handler = null;
        return $this;
    }

    /** Invoke sandbox error validation handler if it exists, throw Error otherwise.
     *
     * @param string|Throwable $error Exception to throw if exception is not handled, or error message string
     * @param int $code The error code
     * @param null|Node $node The error parser node
     * @param mixed $data The error data
     * @param null|Throwable $previous The previous exception thrown
     *
     * @throws Throwable
     */
    public function validationError($error, int $code = 0, ?Node $node = null, $data = null, ?Throwable $previous = null): mixed
    {
        $error = ($error instanceof Throwable)
            ? (($error instanceof Error)
                ? new Error($error->getMessage(), $error->getCode(), $error->getNode(), $error->getData(), $error->getPrevious() ?: $this->last_validation_error)
                : new Error($error->getMessage(), $error->getCode(), null, null, $error->getPrevious() ?: $this->last_validation_error))
            : new Error($error, $code, $node, $data, $previous ?: $this->last_validation_error);

        $this->last_validation_error = $error;
        if ($this->validation_error_handler && is_callable($this->validation_error_handler)) {
            $result = call_user_func_array($this->validation_error_handler, [$error, $this]);
            if ($result instanceof Throwable) {
                throw $result;
            }
            return $result;
        }
        throw $error;
    }
}
