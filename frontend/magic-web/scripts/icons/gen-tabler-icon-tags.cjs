#!/usr/bin/env node

/**
 * Tabler Icons 标签提取器 - 本地文件版本
 * 从本地 node_modules 中的 @tabler/icons 包读取 icons.json 并转换为目标格式
 *
 * 使用方法: node scripts/icons/gen-tabler-icon-tags.cjs
 * 输出: tabler-icons-tags.json
 */

const fs = require('fs')
const path = require('path')

/**
 * 将 kebab-case 转换为 PascalCase
 * 例: "access-point-off" => "AccessPointOff"
 */
function kebabToPascalCase(str) {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
}

/**
 * 生成图标组件名称
 * 例: "access-point-off" => "IconAccessPointOff"
 */
function generateIconName(iconName) {
    return 'Icon' + kebabToPascalCase(iconName)
}

/**
 * 查找本地 @tabler/icons 包的路径
 */
function findTablerIconsPath() {
    // 可能的路径
    const possiblePaths = [
        path.resolve('node_modules/@tabler/icons'),
        path.resolve('../node_modules/@tabler/icons'),
        path.resolve('../../node_modules/@tabler/icons'),
    ]
    
    for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
            return possiblePath
        }
    }
    
    throw new Error('@tabler/icons package not found. Please install it with: npm install @tabler/icons')
}

/**
 * 从本地 node_modules 读取 icons.json
 */
function fetchIconsJson() {
    try {
        // 查找包路径
        const tablerPath = findTablerIconsPath()
        const iconsJsonPath = path.join(tablerPath, 'icons.json')
        
        // 检查文件是否存在
        if (!fs.existsSync(iconsJsonPath)) {
            throw new Error(`icons.json not found at ${iconsJsonPath}`)
        }
        
        // 读取文件
        const data = fs.readFileSync(iconsJsonPath, 'utf8')
        const json = JSON.parse(data)
        
        return json
        
    } catch (error) {
        throw new Error(`Failed to read local icons.json: ${error.message}`)
    }
}

/**
 * 处理图标数据并转换为目标格式
 */
function processIconsData(iconsData) {
    const result = {}
    let processedCount = 0
    let skippedCount = 0
    
    // 数据是对象格式，不是数组
    if (!iconsData || typeof iconsData !== 'object') {
        throw new Error('No icons data found or data format is incorrect')
    }
    
    const iconKeys = Object.keys(iconsData)
    if (iconKeys.length === 0) {
        throw new Error('No icons found in data')
    }
    
    iconKeys.forEach((iconKey) => {
        try {
            const icon = iconsData[iconKey]
            
            // 获取图标名称
            const iconName = icon.name || iconKey
            if (!iconName) {
                skippedCount++
                return
            }
            
            // 获取标签
            const tags = Array.isArray(icon.tags) ? icon.tags : []
            
            // 生成组件名称
            const componentName = generateIconName(iconName)
            result[componentName] = { tags }
            processedCount++
            
        } catch (error) {
            skippedCount++
        }
    })
    
    if (processedCount === 0) {
        throw new Error('No valid icons were processed')
    }
    
    return result
}

/**
 * 主函数
 */
function main() {
    try {
        // 从本地文件读取数据
        const iconsData = fetchIconsJson()
        
        // 处理数据
        const result = processIconsData(iconsData)
        
        // 检查结果
        if (Object.keys(result).length === 0) {
            throw new Error('No valid icons were processed')
        }
        
        // 生成输出文件
        const outputDir = 'src/assets/tabler-icons'
        const outputFile = `${outputDir}/tabler-icons-tags.json`
        
        // 确保输出目录存在
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true })
        }
        
        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8')
        
        // 简洁的成功信息
        console.log(`✅ Generated ${Object.keys(result).length} icons to ${outputFile}`)
        
    } catch (error) {
        console.error('❌ Error:', error.message)
        console.log('\n🔧 Troubleshooting:')
        console.log('1. Make sure @tabler/icons is installed: npm install @tabler/icons')
        console.log('2. Check if node_modules directory exists')
        console.log('3. Verify the @tabler/icons package contains icons.json')
        process.exit(1)
    }
}

// 执行脚本
if (require.main === module) {
    main()
}

module.exports = {
    generateIconName,
    kebabToPascalCase,
    findTablerIconsPath,
    fetchIconsJson,
    processIconsData
}
