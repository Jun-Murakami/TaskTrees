import { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';

const isElectronRenderer = typeof window.electron !== 'undefined';

export function PlatformRouter({ children }: { children: ReactNode }) {
  if (isElectronRenderer) {
    return <HashRouter>{children}</HashRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}
