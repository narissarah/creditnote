// Multi-Currency Manager for International Store Support
import React, { useState, useCallback, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Button,
  Badge,
  Banner,
  TextField
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote } from '../types/credit.types';
import { useOfflineSync } from '../hooks/useOfflineSync';

interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  exchangeRate: number;
  isActive: boolean;
  lastUpdated: string;
  precision: number;
}

interface ExchangeRateProvider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey?: string;
  isActive: boolean;
  updateInterval: number; // minutes
}

interface CurrencyManagerProps {
  baseCurrency?: string;
  onCurrencyUpdate?: (rates: Record<string, number>) => void;
}

const CurrencyManager: React.FC<CurrencyManagerProps> = ({
  baseCurrency = 'USD',
  onCurrencyUpdate
}) => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);
  const [exchangeProviders, setExchangeProviders] = useState<ExchangeRateProvider[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'currencies' | 'providers' | 'conversion'>('currencies');
  const [conversionAmount, setConversionAmount] = useState('100.00');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  
  // Auto-update settings
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [updateInterval, setUpdateInterval] = useState(60); // minutes
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // Hooks
  const { isOnline, addToQueue } = useOfflineSync();

  // Default currencies
  const defaultCurrencies: CurrencyConfig[] = [
    { code: 'USD', symbol: '$', name: 'US Dollar', exchangeRate: 1.0, isActive: true, lastUpdated: new Date().toISOString(), precision: 2 },
    { code: 'EUR', symbol: '€', name: 'Euro', exchangeRate: 0.85, isActive: true, lastUpdated: new Date().toISOString(), precision: 2 },
    { code: 'GBP', symbol: '£', name: 'British Pound', exchangeRate: 0.73, isActive: true, lastUpdated: new Date().toISOString(), precision: 2 },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', exchangeRate: 1.35, isActive: true, lastUpdated: new Date().toISOString(), precision: 2 },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', exchangeRate: 1.52, isActive: true, lastUpdated: new Date().toISOString(), precision: 2 },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', exchangeRate: 110.0, isActive: false, lastUpdated: new Date().toISOString(), precision: 0 },
    { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', exchangeRate: 0.92, isActive: false, lastUpdated: new Date().toISOString(), precision: 2 }
  ];

  // Load currencies and providers on mount
  useEffect(() => {
    loadCurrencyData();
  }, []);

  // Auto-update exchange rates
  useEffect(() => {
    if (!autoUpdateEnabled || !isOnline) return;

    const interval = setInterval(async () => {
      await updateExchangeRates();
    }, updateInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoUpdateEnabled, updateInterval, isOnline]);

  /**
   * Load currency configuration
   */
  const loadCurrencyData = useCallback(async () => {
    setLoading(true);
    try {
      // Load from localStorage or use defaults
      const storedCurrencies = localStorage.getItem('creditcraft_currencies');
      if (storedCurrencies) {
        setCurrencies(JSON.parse(storedCurrencies));
      } else {
        setCurrencies(defaultCurrencies);
        localStorage.setItem('creditcraft_currencies', JSON.stringify(defaultCurrencies));
      }

      // Load exchange rate providers
      const storedProviders = localStorage.getItem('creditcraft_exchange_providers');
      if (storedProviders) {
        setExchangeProviders(JSON.parse(storedProviders));
      } else {
        const defaultProviders: ExchangeRateProvider[] = [
          {
            id: 'exchangerate_api',
            name: 'ExchangeRate-API',
            apiUrl: 'https://api.exchangerate-api.com/v4/latest/',
            isActive: true,
            updateInterval: 60
          }
        ];
        setExchangeProviders(defaultProviders);
        localStorage.setItem('creditcraft_exchange_providers', JSON.stringify(defaultProviders));
      }

      const lastUpdate = localStorage.getItem('creditcraft_last_exchange_update');
      if (lastUpdate) {
        setLastUpdateTime(new Date(lastUpdate));
      }

    } catch (error) {
      api.toast.show('Failed to load currency data', 'error');
    } finally {
      setLoading(false);
    }
  }, [api.toast]);

  /**
   * Update exchange rates from providers
   */
  const updateExchangeRates = useCallback(async () => {
    if (!isOnline) return;

    setLoading(true);
    try {
      const activeProvider = exchangeProviders.find(p => p.isActive);
      if (!activeProvider) {
        throw new Error('No active exchange rate provider');
      }

      const response = await fetch(`${activeProvider.apiUrl}${baseCurrency}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const rates = data.rates || {};

      // Update currency rates
      setCurrencies(prev => prev.map(currency => ({
        ...currency,
        exchangeRate: currency.code === baseCurrency ? 1.0 : (rates[currency.code] || currency.exchangeRate),
        lastUpdated: new Date().toISOString()
      })));

      const updateTime = new Date();
      setLastUpdateTime(updateTime);
      localStorage.setItem('creditcraft_last_exchange_update', updateTime.toISOString());

      // Notify parent component
      if (onCurrencyUpdate) {
        onCurrencyUpdate(rates);
      }

      api.toast.show('Exchange rates updated successfully', 'success');

    } catch (error) {
      console.error('Failed to update exchange rates:', error);
      api.toast.show('Failed to update exchange rates', 'error');
    } finally {
      setLoading(false);
    }
  }, [isOnline, exchangeProviders, baseCurrency, onCurrencyUpdate, api.toast]);

  /**
   * Format amount in specified currency
   */
  const formatAmount = useCallback((
    amount: number, 
    currencyCode: string = baseCurrency
  ): string => {
    const currency = currencies.find(c => c.code === currencyCode);
    if (!currency) return `${amount.toFixed(2)} ${currencyCode}`;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: currency.precision,
      maximumFractionDigits: currency.precision
    }).format(amount);
  }, [currencies, baseCurrency]);

  /**
   * Convert amount between currencies
   */
  const convertAmount = useCallback((
    amount: number,
    fromCode: string,
    toCode: string
  ): number => {
    if (fromCode === toCode) return amount;

    const fromCurrency = currencies.find(c => c.code === fromCode);
    const toCurrency = currencies.find(c => c.code === toCode);

    if (!fromCurrency || !toCurrency) {
      throw new Error(`Currency not found: ${fromCode} or ${toCode}`);
    }

    // Convert to base currency first, then to target currency
    const baseAmount = fromCurrency.code === baseCurrency 
      ? amount 
      : amount / fromCurrency.exchangeRate;
    
    const targetAmount = toCurrency.code === baseCurrency
      ? baseAmount
      : baseAmount * toCurrency.exchangeRate;

    return Number(targetAmount.toFixed(toCurrency.precision));
  }, [currencies, baseCurrency]);

  /**
   * Toggle currency activation
   */
  const toggleCurrency = useCallback((currencyCode: string) => {
    setCurrencies(prev => {
      const updated = prev.map(currency => 
        currency.code === currencyCode 
          ? { ...currency, isActive: !currency.isActive }
          : currency
      );
      localStorage.setItem('creditcraft_currencies', JSON.stringify(updated));
      return updated;
    });
  }, []);

  /**
   * Get conversion result for display
   */
  const getConversionResult = useCallback((): {
    amount: number;
    formatted: string;
    rate: number;
  } | null => {
    try {
      const amount = parseFloat(conversionAmount);
      if (isNaN(amount)) return null;

      const convertedAmount = convertAmount(amount, fromCurrency, toCurrency);
      const fromCurrencyObj = currencies.find(c => c.code === fromCurrency);
      const toCurrencyObj = currencies.find(c => c.code === toCurrency);
      
      if (!fromCurrencyObj || !toCurrencyObj) return null;

      const rate = fromCurrency === baseCurrency
        ? toCurrencyObj.exchangeRate
        : fromCurrency === toCurrency
        ? 1
        : toCurrencyObj.exchangeRate / fromCurrencyObj.exchangeRate;

      return {
        amount: convertedAmount,
        formatted: formatAmount(convertedAmount, toCurrency),
        rate
      };
    } catch (error) {
      return null;
    }
  }, [conversionAmount, fromCurrency, toCurrency, convertAmount, formatAmount, currencies, baseCurrency]);

  return (
    <Navigator>
      <Screen name="CurrencyManager" title="Multi-Currency">
        <ScrollView>
          <Stack spacing="base">
            {/* Status Banner */}
            {!isOnline && (
              <Banner status="warning">
                <Text>Offline - Exchange rates will update when online</Text>
              </Banner>
            )}

            {lastUpdateTime && (
              <Banner status="info">
                <Text>
                  Last updated: {lastUpdateTime.toLocaleString()}
                </Text>
              </Banner>
            )}

            {/* Tab Navigation */}
            <Stack direction="horizontal" spacing="tight">
              <Button
                onPress={() => setActiveTab('currencies')}
                title="Currencies"
                variant={activeTab === 'currencies' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('conversion')}
                title="Converter"
                variant={activeTab === 'conversion' ? 'primary' : 'secondary'}
                fullWidth
              />
              <Button
                onPress={() => setActiveTab('providers')}
                title="Settings"
                variant={activeTab === 'providers' ? 'primary' : 'secondary'}
                fullWidth
              />
            </Stack>


            {/* Currencies Tab */}
            {activeTab === 'currencies' && (
              <Stack spacing="base">
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="headingSm">Supported Currencies</Text>
                  <Button
                    onPress={updateExchangeRates}
                    title="Update Rates"
                    variant="secondary"
                    size="small"
                    loading={loading}
                    disabled={!isOnline}
                  />
                </Stack>
                
                {currencies.map(currency => (
                  <Stack key={currency.code} spacing="base">
                    <Stack direction="horizontal" alignment="space-between">
                      <Stack spacing="extraTight">
                        <Text variant="bodySm" color="emphasis">
                          {currency.symbol} {currency.name} ({currency.code})
                        </Text>
                        <Text variant="bodySm" color="subdued">
                          1 {baseCurrency} = {currency.exchangeRate.toFixed(currency.precision)} {currency.code}
                        </Text>
                        <Text variant="bodySm" color="subdued">
                          Updated: {new Date(currency.lastUpdated).toLocaleString()}
                        </Text>
                      </Stack>
                      
                      <Stack spacing="extraTight" alignment="end">
                        <Badge status={currency.isActive ? 'success' : 'warning'}>
                          {currency.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button
                          onPress={() => toggleCurrency(currency.code)}
                          title={currency.isActive ? 'Disable' : 'Enable'}
                          variant="secondary"
                          size="small"
                        />
                      </Stack>
                    </Stack>
                    
                  </Stack>
                ))}
              </Stack>
            )}

            {/* Currency Converter Tab */}
            {activeTab === 'conversion' && (
              <Stack spacing="base">
                <Text variant="headingSm">Currency Converter</Text>
                
                <TextField
                  label="Amount"
                  value={conversionAmount}
                  onChange={setConversionAmount}
                  type="number"
                  step="0.01"
                />

                <Stack direction="horizontal" spacing="tight">
                  <Stack spacing="tight" fullWidth>
                    <Text variant="bodySm">From</Text>
                    <Stack direction="horizontal" spacing="tight">
                      {currencies.filter(c => c.isActive).slice(0, 3).map(currency => (
                        <Button
                          key={currency.code}
                          onPress={() => setFromCurrency(currency.code)}
                          title={currency.code}
                          variant={fromCurrency === currency.code ? 'primary' : 'secondary'}
                          size="small"
                          fullWidth
                        />
                      ))}
                    </Stack>
                  </Stack>

                  <Stack spacing="tight" fullWidth>
                    <Text variant="bodySm">To</Text>
                    <Stack direction="horizontal" spacing="tight">
                      {currencies.filter(c => c.isActive && c.code !== fromCurrency).slice(0, 3).map(currency => (
                        <Button
                          key={currency.code}
                          onPress={() => setToCurrency(currency.code)}
                          title={currency.code}
                          variant={toCurrency === currency.code ? 'primary' : 'secondary'}
                          size="small"
                          fullWidth
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Stack>

                {/* Conversion Result */}
                {(() => {
                  const result = getConversionResult();
                  if (!result) return null;

                  return (
                    <Stack spacing="tight">
                      <Text variant="headingMd">
                        {formatAmount(parseFloat(conversionAmount), fromCurrency)} = {result.formatted}
                      </Text>
                      <Text variant="bodySm" color="subdued">
                        Exchange rate: 1 {fromCurrency} = {result.rate.toFixed(4)} {toCurrency}
                      </Text>
                    </Stack>
                  );
                })()}

                {/* Quick Conversion Examples */}
                <Stack spacing="base">
                  <Text variant="headingSm">Quick References</Text>
                  {[10, 25, 50, 100, 500].map(amount => {
                    try {
                      const converted = convertAmount(amount, fromCurrency, toCurrency);
                      return (
                        <Stack key={amount} direction="horizontal" alignment="space-between">
                          <Text variant="bodySm">
                            {formatAmount(amount, fromCurrency)}
                          </Text>
                          <Text variant="bodySm">
                            {formatAmount(converted, toCurrency)}
                          </Text>
                        </Stack>
                      );
                    } catch {
                      return null;
                    }
                  })}
                </Stack>
              </Stack>
            )}

            {/* Settings Tab */}
            {activeTab === 'providers' && (
              <Stack spacing="base">
                <Text variant="headingSm">Exchange Rate Settings</Text>
                
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="bodySm">Auto-update exchange rates</Text>
                  <Button
                    onPress={() => setAutoUpdateEnabled(prev => !prev)}
                    title={autoUpdateEnabled ? 'On' : 'Off'}
                    variant={autoUpdateEnabled ? 'primary' : 'secondary'}
                    size="small"
                  />
                </Stack>

                {autoUpdateEnabled && (
                  <TextField
                    label="Update interval (minutes)"
                    value={updateInterval.toString()}
                    onChange={(value) => setUpdateInterval(parseInt(value) || 60)}
                    type="number"
                    min="5"
                    max="1440"
                  />
                )}

                <Text variant="bodySm" color="subdued">
                  Base currency: {baseCurrency}
                </Text>

                <Stack spacing="base">
                  <Text variant="headingSm">Exchange Rate Providers</Text>
                  {exchangeProviders.map(provider => (
                    <Stack key={provider.id} spacing="tight">
                      <Stack direction="horizontal" alignment="space-between">
                        <Text variant="bodySm" color="emphasis">
                          {provider.name}
                        </Text>
                        <Badge status={provider.isActive ? 'success' : 'warning'}>
                          {provider.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </Stack>
                      <Text variant="bodySm" color="subdued">
                        {provider.apiUrl}
                      </Text>
                    </Stack>
                  ))}
                </Stack>

                <Button
                  onPress={() => {
                    // Save settings
                    localStorage.setItem('creditcraft_auto_update', JSON.stringify(autoUpdateEnabled));
                    localStorage.setItem('creditcraft_update_interval', updateInterval.toString());
                    api.toast.show('Settings saved successfully', 'success');
                  }}
                  title="Save Settings"
                  variant="primary"
                  fullWidth
                />
              </Stack>
            )}

            {/* Usage Instructions */}
            <Stack spacing="base">
              <Text variant="headingSm">Multi-Currency Features</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">• Real-time exchange rate updates</Text>
                <Text variant="bodySm">• Support for 7+ major currencies</Text>
                <Text variant="bodySm">• Automatic currency conversion</Text>
                <Text variant="bodySm">• Offline exchange rate caching</Text>
                <Text variant="bodySm">• Credit notes in multiple currencies</Text>
                <Text variant="bodySm">• Cross-currency redemption support</Text>
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

// Export currency utilities for use in other components
export const useCurrency = () => {
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('creditcraft_currencies');
    if (stored) {
      setCurrencies(JSON.parse(stored));
    }
  }, []);

  const formatCurrency = useCallback((amount: number, currencyCode: string = 'USD'): string => {
    const currency = currencies.find(c => c.code === currencyCode);
    if (!currency) return `${amount.toFixed(2)} ${currencyCode}`;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: currency.precision,
      maximumFractionDigits: currency.precision
    }).format(amount);
  }, [currencies]);

  const convertCurrency = useCallback((
    amount: number,
    fromCode: string,
    toCode: string,
    baseCurrency: string = 'USD'
  ): number => {
    if (fromCode === toCode) return amount;

    const fromCurrency = currencies.find(c => c.code === fromCode);
    const toCurrency = currencies.find(c => c.code === toCode);

    if (!fromCurrency || !toCurrency) return amount;

    const baseAmount = fromCurrency.code === baseCurrency 
      ? amount 
      : amount / fromCurrency.exchangeRate;
    
    const targetAmount = toCurrency.code === baseCurrency
      ? baseAmount
      : baseAmount * toCurrency.exchangeRate;

    return Number(targetAmount.toFixed(toCurrency.precision));
  }, [currencies]);

  return {
    currencies: currencies.filter(c => c.isActive),
    formatCurrency,
    convertCurrency
  };
};

export default CurrencyManager;