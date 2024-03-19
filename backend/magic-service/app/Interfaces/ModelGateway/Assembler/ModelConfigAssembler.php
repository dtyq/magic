<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Assembler;

use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Interfaces\ModelGateway\DTO\ModelConfigDTO;

class ModelConfigAssembler
{
    public static function createDTO(ModelConfigEntity $DO): ModelConfigDTO
    {
        $DTO = new ModelConfigDTO();
        $DTO->setId($DO->getId());
        $DTO->setName($DO->getName());
        $DTO->setModel($DO->getModel());
        $DTO->setType($DO->getType());
        $DTO->setEnabled($DO->isEnabled());
        $DTO->setTotalAmount($DO->getTotalAmount());
        $DTO->setUseAmount($DO->getUseAmount());
        $DTO->setExchangeRate($DO->getExchangeRate());
        $DTO->setInputCostPer1000($DO->getInputCostPer1000());
        $DTO->setOutputCostPer1000($DO->getOutputCostPer1000());
        $DTO->setRpm($DO->getRpm());
        $DTO->setImplementation($DO->getImplementation());
        $DTO->setImplementationConfig($DO->getImplementationConfig());
        $DTO->setCreatedAt($DO->getCreatedAt());
        $DTO->setUpdatedAt($DO->getUpdatedAt());
        return $DTO;
    }

    public static function createDO(ModelConfigDTO $DTO): ModelConfigEntity
    {
        $DO = new ModelConfigEntity();
        ! is_null($DTO->getModel()) && $DO->setModel($DTO->getModel());
        ! is_null($DTO->getType()) && $DO->setType($DTO->getType());
        ! is_null($DTO->getName()) && $DO->setName($DTO->getName());
        ! is_null($DTO->getEnabled()) && $DO->setEnabled($DTO->getEnabled());
        ! is_null($DTO->getTotalAmount()) && $DO->setTotalAmount($DTO->getTotalAmount());
        ! is_null($DTO->getExchangeRate()) && $DO->setExchangeRate($DTO->getExchangeRate());
        ! is_null($DTO->getInputCostPer1000()) && $DO->setInputCostPer1000($DTO->getInputCostPer1000());
        ! is_null($DTO->getOutputCostPer1000()) && $DO->setOutputCostPer1000($DTO->getOutputCostPer1000());
        ! is_null($DTO->getRpm()) && $DO->setRpm($DTO->getRpm());
        ! is_null($DTO->getImplementation()) && $DO->setImplementation($DTO->getImplementation());
        ! is_null($DTO->getImplementationConfig()) && $DO->setImplementationConfig($DTO->getImplementationConfig());
        return $DO;
    }

    public static function createListDTO(array $DOs): array
    {
        $DTOs = [];
        foreach ($DOs as $DO) {
            $DTOs[] = self::createDTO($DO);
        }
        return $DTOs;
    }
}
