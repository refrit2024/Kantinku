import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Tier 1: Maps JavaScript API & Map Loading Level Quota / Auth Defense
(window as any).__gmpLoadFailed = false;

(window as any).gm_authFailure = () => {
  (window as any).__gmpLoadFailed = true;
  window.dispatchEvent(new CustomEvent('gmp-map-load-error'));
};

const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    (window as any).__gmpLoadFailed = true;
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    window.dispatchEvent(new CustomEvent('gmp-map-load-error'));
  }
  if (
    msg.includes('RefererNotAllowedMapError') ||
    msg.includes('MissingKeyMapError') ||
    msg.includes('InvalidKeyMapError') ||
    msg.includes('BillingNotEnabledMapError') ||
    msg.includes('ApiNotActivatedMapError') ||
    msg.includes('ApiTargetBlockedMapError')
  ) {
    (window as any).__gmpLoadFailed = true;
    window.dispatchEvent(new CustomEvent('gmp-map-load-error'));
  }
};

createRoot(document.getElementById('root')!).render(<App />);
