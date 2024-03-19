<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Api;

use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\Structure\Form\Form;
use JsonSerializable;

class ApiRequest implements JsonSerializable
{
    private ?Component $paramsQuery = null;

    private ?Component $paramsPath = null;

    private ?ApiRequestBodyType $apiRequestBodyType = null;

    private ?Component $body = null;

    private ?Component $headers = null;

    public function jsonSerialize(): array
    {
        return [
            'params_query' => $this->paramsQuery?->jsonSerialize(),
            'params_path' => $this->paramsPath?->jsonSerialize(),
            'body_type' => $this->apiRequestBodyType?->getValue(),
            'body' => $this->body?->jsonSerialize(),
            'headers' => $this->headers?->jsonSerialize(),
        ];
    }

    public function getSpecialParamsQuery(): ?Form
    {
        return $this->paramsQuery?->getForm();
    }

    public function getSpecialParamsPath(): ?Form
    {
        return $this->paramsPath?->getForm();
    }

    public function getSpecialBody(): ?Form
    {
        return $this->body?->getForm();
    }

    public function getSpecialHeaders(): ?Form
    {
        return $this->headers?->getForm();
    }

    public function getParamsQuery(): ?Component
    {
        return $this->paramsQuery;
    }

    public function setParamsQuery(?Component $paramsQuery): void
    {
        $this->paramsQuery = $paramsQuery;
    }

    public function getParamsPath(): ?Component
    {
        return $this->paramsPath;
    }

    public function setParamsPath(?Component $paramsPath): void
    {
        $this->paramsPath = $paramsPath;
    }

    public function getApiRequestBodyType(): ?ApiRequestBodyType
    {
        return $this->apiRequestBodyType;
    }

    public function setApiRequestBodyType(?ApiRequestBodyType $apiRequestBodyType): void
    {
        $this->apiRequestBodyType = $apiRequestBodyType;
    }

    public function getBody(): ?Component
    {
        return $this->body;
    }

    public function setBody(?Component $body): void
    {
        $this->body = $body;
    }

    public function getHeaders(): ?Component
    {
        return $this->headers;
    }

    public function setHeaders(?Component $headers): void
    {
        $this->headers = $headers;
    }

    public function getAllFieldsExpressionItem(): array
    {
        $fields = [];
        $fields = array_merge($fields, $this->getSpecialParamsQuery()?->getAllFieldsExpressionItem() ?? []);
        $fields = array_merge($fields, $this->getSpecialParamsPath()?->getAllFieldsExpressionItem() ?? []);
        $fields = array_merge($fields, $this->getSpecialBody()?->getAllFieldsExpressionItem() ?? []);
        return array_merge($fields, $this->getSpecialHeaders()?->getAllFieldsExpressionItem() ?? []);
    }
}
