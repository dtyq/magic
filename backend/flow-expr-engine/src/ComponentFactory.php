<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine;

use Dtyq\FlowExprEngine\Structure\Structure;
use Dtyq\FlowExprEngine\Structure\StructureType;
use Throwable;

class ComponentFactory
{
    public static function fastCreate(null|array|Component $config, bool $strict = true, bool $lazy = false): ?Component
    {
        if (! $config) {
            return null;
        }
        if ($config instanceof Component) {
            return $config;
        }
        try {
            $type = $config['type'] ?? '';
            
            // Infer type from structure if type is missing
            if (empty($type) && ! empty($config['structure'])) {
                $inferredType = self::inferTypeFromStructure($config['structure']);
                if ($inferredType) {
                    $type = $inferredType;
                }
            }
            
            $component = self::simpleCreate($type, $config['structure'] ?? [], $config['id'] ?? null, $lazy);
        } catch (Throwable $throwable) {
            if ($strict) {
                throw $throwable;
            }
            $component = null;
        }
        return $component;
    }

    public static function fastUpdate(?Component $component, ?Component $savingComponent): ?Component
    {
        if (! $savingComponent) {
            return $component;
        }
        if ($component) {
            $component->setStructure($savingComponent->getStructure());
        } else {
            $component = $savingComponent;
        }
        return $component;
    }

    public static function generateTemplate(StructureType $type, array $structure = []): ?Component
    {
        $componentId = self::generateComponentId();
        $static = new Component();
        $static->setId($componentId);
        $static->setVersion('1');
        $static->setType($type);
        $static->createTemplate($structure);
        return $static;
    }

    private static function generateComponentId(): string
    {
        return uniqid('component-');
    }

    /**
     * Infer component type from structure characteristics.
     */
    private static function inferTypeFromStructure(array $structure): ?string
    {
        // 1. Check for Condition (highest priority due to specific 'ops' field)
        if (isset($structure['ops']) && isset($structure['children'])) {
            return 'condition';
        }
        
        // 2. Check for Api (specific 'method' field with path or url)
        if (isset($structure['method']) && (isset($structure['path']) || isset($structure['url']))) {
            return 'api';
        }
        
        // 3. Check for Value (has type='expression' with const_value and expression_value)
        if (isset($structure['type']) && $structure['type'] === 'expression' 
            && (array_key_exists('const_value', $structure) || array_key_exists('expression_value', $structure))) {
            return 'value';
        }
        
        // 4. Check for Expression (is array with items containing type, value, name)
        if (array_is_list($structure) && ! empty($structure)) {
            $firstItem = $structure[0];
            if (is_array($firstItem) && isset($firstItem['type']) && isset($firstItem['value'])) {
                return 'expression';
            }
        }
        
        // 5. Check for Form/Widget (has key, type, properties fields)
        if (isset($structure['key']) && isset($structure['type']) 
            && in_array($structure['type'], ['object', 'array', 'string', 'number', 'boolean', 'null'])) {
            return 'form'; // Default to 'form', cannot distinguish from 'widget' by structure alone
        }
        
        return null;
    }

    private static function simpleCreate(string|StructureType $type, null|array|Structure $structure, ?string $id = null, bool $lazy = false): Component
    {
        if (! $id) {
            $id = self::generateComponentId();
        }

        if (is_string($type)) {
            $type = StructureType::from($type);
        }
        $static = new Component();
        $static->setId($id);
        $static->setVersion('1');
        $static->setType($type);

        if ($lazy && is_array($structure)) {
            $static->setStructureLazy($structure);
        } else {
            $static->initStructure($structure);
        }
        return $static;
    }
}
