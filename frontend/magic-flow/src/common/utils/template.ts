/**
 * 模板字符串解析函数
 * 支持解析 ${expression} 格式的模板字符串
 * 
 * @param template 模板字符串，包含 ${expression} 格式的表达式
 * @param context 上下文对象，用于解析表达式
 * @param options 配置选项
 * @param options.partial 解析失败时是否保留原始表达式字符串，默认为 false，返回 undefined
 * @returns 解析后的字符串
 */
export function resolveToString(
  template: string,
  context: Record<string, any> = {},
  options: { partial?: boolean } = {}
): string {
  // 处理转义字符
  let result = '';
  let i = 0;
  const length = (template || "").length;
  
  while (i < length) {
    // 处理转义字符
    if (template[i] === '\\' && i + 1 < length && template[i + 1] === '$') {
      result += '$';
      i += 2; // 跳过 \$
      continue;
    }
    
    // 查找下一个模板表达式的开始
    if (template[i] === '$' && i + 1 < length && template[i + 1] === '{') {
      // 找到表达式的结束位置
      const start = i;
      i += 2; // 跳过 ${
      let braceCount = 1;
      let expressionEnd = -1;
      
      while (i < length) {
        if (template[i] === '{') {
          braceCount++;
        } else if (template[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            expressionEnd = i;
            break;
          }
        }
        i++;
      }
      
      if (expressionEnd === -1) {
        // 未找到匹配的闭合括号，将整个剩余部分作为普通文本
        result += template.substring(start);
        i = length;
      } else {
        // 提取表达式
        const expression = template.substring(start + 2, expressionEnd);
        i = expressionEnd + 1; // 跳过 }
        
        try {
          // 获取上下文对象的所有有效变量名
          const names = Object.keys(context).filter(name => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name));
          const argNames = names.join(', ');
          const argValues = names.map(name => context[name]);

          // 使用 Function 构造函数创建一个动态函数执行表达式
          // eslint-disable-next-line no-new-func
          const resolver = new Function(argNames, `return (${expression})`);
          
          try {
            // 执行表达式并获取结果
            const exprResult = resolver.apply(null, argValues);
            result += exprResult === undefined ? '' : String(exprResult);
          } catch (e) {
            // 表达式执行失败
            if (options.partial) {
              result += '${' + expression + '}'; // 返回原始模板字符串 ${...}
            } else {
              result += 'undefined';
            }
          }
        } catch (e) {
          // 表达式编译失败
          if (options.partial) {
            result += '${' + expression + '}'; // 返回原始模板字符串 ${...}
          } else {
            result += 'undefined';
          }
        }
      }
    } else {
      // 普通字符
      result += template[i];
      i++;
    }
  }
  
  return result;
}

export default resolveToString; 