<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace PHPSandbox;

use Exception;
use PhpParser\Node;
use Throwable;

/**
 * Error class for PHP Sandboxes.
 *
 * This class extends Exception to allow for catching PHPSandbox-specific exceptions.
 *
 * @namespace PHPSandbox
 *
 * @version 3.0
 */
class Error extends Exception
{
    /* START ERROR CODES */
    /* MISC ERRORS                      (1-99) */
    public const PARSER_ERROR = 1;

    public const ESCAPE_ERROR = 2;

    public const HALT_ERROR = 3;

    public const CAST_ERROR = 4;

    public const CLOSURE_ERROR = 5;

    public const BYREF_ERROR = 6;

    public const GENERATOR_ERROR = 7;

    public const GLOBALS_ERROR = 8;

    public const DYNAMIC_VAR_ERROR = 9;

    public const STATIC_VAR_ERROR = 10;

    public const ERROR_SUPPRESS_ERROR = 11;

    public const BACKTICKS_ERROR = 12;

    public const IMPORT_ERROR = 13;

    public const INCLUDE_ERROR = 14;

    public const DYNAMIC_STATIC_VAR_ERROR = 20;

    public const DYNAMIC_CONST_ERROR = 21;

    public const DYNAMIC_CLASS_ERROR = 22;

    public const SANDBOX_ACCESS_ERROR = 30;

    public const GLOBAL_CONST_ERROR = 31;

    public const CREATE_OBJECT_ERROR = 32;

    /* VALIDATION ERRORS                (100-199) */
    public const VALID_FUNC_ERROR = 100;

    public const VALID_KEYWORD_ERROR = 101;

    public const VALID_CONST_ERROR = 102;

    public const VALID_VAR_ERROR = 103;

    public const VALID_GLOBAL_ERROR = 104;

    public const VALID_SUPERGLOBAL_ERROR = 105;

    public const VALID_MAGIC_CONST_ERROR = 106;

    public const VALID_CLASS_ERROR = 107;

    public const VALID_TYPE_ERROR = 108;

    public const VALID_INTERFACE_ERROR = 109;

    public const VALID_TRAIT_ERROR = 110;

    public const VALID_NAMESPACE_ERROR = 111;

    public const VALID_ALIAS_ERROR = 112;

    public const VALID_OPERATOR_ERROR = 113;

    public const VALID_PRIMITIVE_ERROR = 114;

    /* DEFINITION ERRORS                (200-299) */
    public const DEFINE_FUNC_ERROR = 200;

    public const DEFINE_KEYWORD_ERROR = 201;

    public const DEFINE_CONST_ERROR = 202;

    public const DEFINE_VAR_ERROR = 203;

    public const DEFINE_GLOBAL_ERROR = 204;

    public const DEFINE_SUPERGLOBAL_ERROR = 205;

    public const DEFINE_MAGIC_CONST_ERROR = 206;

    public const DEFINE_CLASS_ERROR = 207;

    public const DEFINE_TYPE_ERROR = 208;

    public const DEFINE_INTERFACE_ERROR = 209;

    public const DEFINE_TRAIT_ERROR = 210;

    public const DEFINE_NAMESPACE_ERROR = 211;

    public const DEFINE_ALIAS_ERROR = 212;

    public const DEFINE_OPERATOR_ERROR = 213;

    public const DEFINE_PRIMITIVE_ERROR = 214;

    /* WHITELIST ERRORS                     (300-399) */
    public const WHITELIST_FUNC_ERROR = 300;

    public const WHITELIST_KEYWORD_ERROR = 301;

    public const WHITELIST_CONST_ERROR = 302;

    public const WHITELIST_VAR_ERROR = 303;

    public const WHITELIST_GLOBAL_ERROR = 304;

    public const WHITELIST_SUPERGLOBAL_ERROR = 305;

    public const WHITELIST_MAGIC_CONST_ERROR = 306;

    public const WHITELIST_CLASS_ERROR = 307;

    public const WHITELIST_TYPE_ERROR = 308;

    public const WHITELIST_INTERFACE_ERROR = 309;

    public const WHITELIST_TRAIT_ERROR = 310;

    public const WHITELIST_NAMESPACE_ERROR = 311;

    public const WHITELIST_ALIAS_ERROR = 312;

    public const WHITELIST_OPERATOR_ERROR = 313;

    public const WHITELIST_PRIMITIVE_ERROR = 314;

    /* BLACKLIST ERRORS                     (400-499) */
    public const BLACKLIST_FUNC_ERROR = 400;

    public const BLACKLIST_KEYWORD_ERROR = 401;

    public const BLACKLIST_CONST_ERROR = 402;

    public const BLACKLIST_VAR_ERROR = 403;

    public const BLACKLIST_GLOBAL_ERROR = 404;

    public const BLACKLIST_SUPERGLOBAL_ERROR = 405;

    public const BLACKLIST_MAGIC_CONST_ERROR = 406;

    public const BLACKLIST_CLASS_ERROR = 407;

    public const BLACKLIST_TYPE_ERROR = 408;

    public const BLACKLIST_INTERFACE_ERROR = 409;

    public const BLACKLIST_TRAIT_ERROR = 410;

    public const BLACKLIST_NAMESPACE_ERROR = 411;

    public const BLACKLIST_ALIAS_ERROR = 412;

    public const BLACKLIST_OPERATOR_ERROR = 413;

    public const BLACKLIST_PRIMITIVE_ERROR = 414;

    /* END ERROR CODES */
    /**
     * @var null|Node The node of the Error
     */
    protected ?Node $node;

    /**
     * @var mixed The data of the Error
     */
    protected $data;

    /** Constructs the Error.
     * @param string $message The message to pass to the Error
     * @param int $code The error code to pass to the Error
     * @param null|Node $node The parser node to pass to the Error
     * @param mixed $data The error data to pass to the Error
     * @param null|Throwable $previous The previous exception to pass to the Error
     */
    public function __construct($message = '', $code = 0, ?Node $node = null, $data = null, ?Throwable $previous = null)
    {
        $this->node = $node;
        $this->data = $data;
        parent::__construct($message, $code, $previous);
    }

    /** Returns data of the Error.
     *
     * @alias get_data();
     *
     * @return mixed The data of the error to return
     */
    public function getData()
    {
        return $this->data;
    }

    /** Returns parser node of the Error.
     *
     * @alias get_node();
     *
     * @return null|Node The parser node of the error to return
     */
    public function getNode(): ?Node
    {
        return $this->node;
    }
}
