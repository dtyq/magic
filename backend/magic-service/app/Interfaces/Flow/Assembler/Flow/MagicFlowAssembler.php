<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\Flow;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\Assembler\Node\MagicFlowNodeAssembler;
use App\Interfaces\Flow\DTO\Flow\MagicFlowDTO;
use App\Interfaces\Flow\DTO\Flow\MagicFlowListDTO;
use App\Interfaces\Flow\DTO\Flow\MagicFlowParamDTO;
use App\Interfaces\Flow\DTO\Node\NodeDTO;
use App\Interfaces\Flow\DTO\Node\NodeInputDTO;
use App\Interfaces\Flow\DTO\Node\NodeOutputDTO;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class MagicFlowAssembler
{
    public static function createMagicFlowDTOByMixed(mixed $data): ?MagicFlowDTO
    {
        if ($data instanceof MagicFlowDTO) {
            return $data;
        }
        if (is_array($data)) {
            return new MagicFlowDTO($data);
        }
        return null;
    }

    public static function createMagicFlowDO(MagicFlowDTO $magicFlowDTO): MagicFlowEntity
    {
        $magicFlow = new MagicFlowEntity();
        $magicFlow->setCode((string) $magicFlowDTO->getId());
        $magicFlow->setName($magicFlowDTO->getName());
        $magicFlow->setDescription($magicFlowDTO->getDescription());
        $magicFlow->setIcon(FileAssembler::formatPath($magicFlowDTO->getIcon()));
        $magicFlow->setToolSetId($magicFlowDTO->getToolSetId());
        $magicFlow->setType(Type::from($magicFlowDTO->getType()));
        $magicFlow->setEnabled($magicFlowDTO->isEnabled());
        $magicFlow->setNodes(array_map(fn (NodeDTO $nodeDTO) => MagicFlowNodeAssembler::createNodeDO($nodeDTO), $magicFlowDTO->getNodes()));
        $magicFlow->setEdges($magicFlowDTO->getEdges());
        $magicFlow->setGlobalVariable($magicFlowDTO->getGlobalVariable());
        return $magicFlow;
    }

    /**
     * @param array<string,FileLink> $icons
     */
    public static function createMagicFlowDTO(MagicFlowEntity $magicFlowEntity, array $icons = [], array $users = []): MagicFlowDTO
    {
        $magicFlowDTO = new MagicFlowDTO($magicFlowEntity->toArray());
        $magicFlowDTO->setId($magicFlowEntity->getCode());
        $magicFlowDTO->setIcon(FileAssembler::getUrl($icons[$magicFlowEntity->getIcon()] ?? null));
        $magicFlowDTO->setUserOperation($magicFlowEntity->getUserOperation());

        $magicFlowDTO->setCreator($magicFlowEntity->getCreator());
        $magicFlowDTO->setCreatedAt($magicFlowEntity->getCreatedAt());
        $magicFlowDTO->setModifier($magicFlowEntity->getModifier());
        $magicFlowDTO->setUpdatedAt($magicFlowEntity->getUpdatedAt());
        $magicFlowDTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowEntity->getCreator()] ?? null, $magicFlowEntity->getCreatedAt()));
        $magicFlowDTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowEntity->getModifier()] ?? null, $magicFlowEntity->getUpdatedAt()));
        return $magicFlowDTO;
    }

    public static function createMagicFlowParamsDTO(MagicFlowEntity $magicFlowEntity): MagicFlowParamDTO
    {
        $magicFlowDTO = new MagicFlowParamDTO($magicFlowEntity->toArray());
        $magicFlowDTO->setId($magicFlowEntity->getCode());

        $input = new NodeInputDTO();
        $input->setForm($magicFlowEntity->getInput()?->getForm());
        $input->setWidget($magicFlowEntity->getInput()?->getWidget());
        $magicFlowDTO->setInput($input);

        $output = new NodeOutputDTO();
        $output->setForm($magicFlowEntity->getOutput()?->getForm());
        $output->setWidget($magicFlowEntity->getOutput()?->getWidget());
        $magicFlowDTO->setOutput($output);

        return $magicFlowDTO;
    }

    /**
     * @param MagicFlowEntity[] $list
     * @param array<string,MagicUserEntity> $users
     * @param array<string,FileLink> $icons
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = [], array $icons = []): PageDTO
    {
        $list = array_map(fn (MagicFlowEntity $magicFlowEntity) => self::createMagicFlowListDTO($magicFlowEntity, $users, $icons), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    /**
     * @param array<string,MagicUserEntity> $users
     * @param array<string,FileLink> $icons
     */
    protected static function createMagicFlowListDTO(MagicFlowEntity $magicFlowEntity, array $users = [], array $icons = []): MagicFlowListDTO
    {
        $magicFlowDTO = new MagicFlowListDTO($magicFlowEntity->toArray());
        $magicFlowDTO->setId($magicFlowEntity->getCode());
        $magicFlowDTO->setIcon(FileAssembler::getUrl($icons[$magicFlowEntity->getIcon()] ?? null));
        $magicFlowDTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity(
            user: $users[$magicFlowEntity->getCreator()] ?? null,
            dateTime: $magicFlowEntity->getCreatedAt()
        ));
        $magicFlowDTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity(
            user: $users[$magicFlowEntity->getModifier()] ?? null,
            dateTime: $magicFlowEntity->getUpdatedAt()
        ));
        $magicFlowDTO->setUserOperation($magicFlowEntity->getUserOperation());

        // 只有工具的时候才显示入参出参
        if ($magicFlowEntity->getType()->isTools()) {
            $input = new NodeInputDTO();
            $input->setForm($magicFlowEntity->getInput()?->getForm());
            $input->setWidget($magicFlowEntity->getInput()?->getWidget());
            $magicFlowDTO->setInput($input);

            $output = new NodeOutputDTO();
            $output->setForm($magicFlowEntity->getOutput()?->getForm());
            $output->setWidget($magicFlowEntity->getOutput()?->getWidget());
            $magicFlowDTO->setOutput($output);

            $customSystemOutput = new NodeInputDTO();
            $customSystemOutput->setForm($magicFlowEntity->getCustomSystemInput()?->getForm());
            $customSystemOutput->setWidget($magicFlowEntity->getCustomSystemInput()?->getWidget());
            $magicFlowDTO->setCustomSystemInput($customSystemOutput);
        }

        return $magicFlowDTO;
    }
}
