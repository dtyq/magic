import React from "react"
import { MagicFlowContext } from "./Context"
import { useStore as useZustandStore } from 'zustand';
import { BaseNodeType } from "@/MagicFlow/register/node";

export const useMagicFlow = () => {
	const store = React.useContext(MagicFlowContext)

    if (!store) {
        throw new Error('useMagicFlow must be used within a MagicFlowProvider');
    }

    const displayMaterialTypes = useZustandStore(store, state => state.displayMaterialTypes) as BaseNodeType[];

    return {
        displayMaterialTypes,
        updateDisplayMaterialType: store.getState().updateDisplayMaterialType,
    };
}
