import { ReactNode } from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';

const isElectron = navigator.userAgent.includes('Electron');

export function PlatformRouter({ children }: { children: ReactNode }) {
  if (isElectron) {
    return <HashRouter>{children}</HashRouter>;
  }
  return <BrowserRouter>{children}</BrowserRouter>;
}
