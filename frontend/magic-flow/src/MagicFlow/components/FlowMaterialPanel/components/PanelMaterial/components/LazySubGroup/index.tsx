import { MaterialGroup } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { BaseNodeType, NodeGroup, NodeWidget } from "@/MagicFlow/register/node"
import React, { ReactNode, useState, useRef, useEffect, memo } from "react"
import SubGroup from "../SubGroup/SubGroup"

interface LazySubGroupProps {
    subGroup: NodeGroup | MaterialGroup
    getGroupNodeList: (nodeTypes: BaseNodeType[]) => NodeWidget[]
    materialFn: (n: NodeWidget, extraProps: Record<string, any>) => ReactNode
    index: number
}

/**
 * 懒加载SubGroup组件，只有当组件进入视口时才渲染内容
 */
function LazySubGroup({ subGroup, getGroupNodeList, materialFn, index }: LazySubGroupProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // 当组件进入视口时
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    
                    // 标记为已加载，避免重复渲染
                    if (!isLoaded) {
                        setIsLoaded(true);
                    }
                    
                    // 组件已加载后可以解除观察
                    if (ref.current) {
                        observer.unobserve(ref.current);
                    }
                }
            },
            {
                rootMargin: '100px', // 提前100px开始加载
                threshold: 0.1 // 10%可见时触发
            }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, [isLoaded]);

    // 渲染一个占位符或实际内容
    return (
        <div ref={ref} style={{ minHeight: '50px' }}>
            {(isVisible || isLoaded) ? (
                <SubGroup
                    subGroup={subGroup}
                    getGroupNodeList={getGroupNodeList}
                    materialFn={(n, extraProps) => materialFn(n, {
                        ...extraProps,
                        key: `item-${index}-${n.schema?.id || 0}`
                    })}
                />
            ) : (
                <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    加载中...
                </div>
            )}
        </div>
    );
}

export default memo(LazySubGroup); 