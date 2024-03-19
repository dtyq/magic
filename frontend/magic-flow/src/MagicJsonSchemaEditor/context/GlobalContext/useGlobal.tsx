import React from 'react';
import { GlobalContext } from './Context';

export const useGlobal = () => {
  return React.useContext(GlobalContext);
};
