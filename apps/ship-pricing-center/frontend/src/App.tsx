import { getApiConfig } from './api/client';

const { baseUrl: apiBaseUrl, apiKey } = getApiConfig();
const dashboardUrl = '/ship-pricing.html';

function persistDashboardConfig() {
  try {
    window.localStorage.setItem('shipPricingApiBaseUrl', apiBaseUrl);
    window.localStorage.setItem('shipPricingApiKey', apiKey);
  } catch {
    // The static dashboard can still use URL fallback config if storage is unavailable.
  }
}

persistDashboardConfig();

export default function App() {
  return (
    <iframe
      className="ship-pricing-frame"
      src={dashboardUrl}
      title="Ship Pricing Center"
    />
  );
}
