<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Volcengine\Base;

class SignResult
{
    private string $xDate = '';

    private string $xCredential = '';

    private string $xAlgorithm = '';

    private string $xSignedHeaders = '';

    private string $xSignedQueries = '';

    private string $xSignature = '';

    private string $authorization = '';

    public function __toString()
    {
        return $this->xDate . $this->authorization . $this->xCredential . $this->xSignature;
    }

    public function getXDate(): string
    {
        return $this->xDate;
    }

    public function setXDate(string $xDate): void
    {
        $this->xDate = $xDate;
    }

    public function getXCredential(): string
    {
        return $this->xCredential;
    }

    public function setXCredential(string $xCredential): void
    {
        $this->xCredential = $xCredential;
    }

    public function getXAlgorithm(): string
    {
        return $this->xAlgorithm;
    }

    public function setXAlgorithm(string $xAlgorithm): void
    {
        $this->xAlgorithm = $xAlgorithm;
    }

    public function getXSignedHeaders(): string
    {
        return $this->xSignedHeaders;
    }

    public function setXSignedHeaders(string $xSignedHeaders): void
    {
        $this->xSignedHeaders = $xSignedHeaders;
    }

    public function getXSignedQueries(): string
    {
        return $this->xSignedQueries;
    }

    public function setXSignedQueries(string $xSignedQueries): void
    {
        $this->xSignedQueries = $xSignedQueries;
    }

    public function getXSignature(): string
    {
        return $this->xSignature;
    }

    public function setXSignature(string $xSignature): void
    {
        $this->xSignature = $xSignature;
    }

    public function getAuthorization(): string
    {
        return $this->authorization;
    }

    public function setAuthorization(string $authorization): void
    {
        $this->authorization = $authorization;
    }
}
