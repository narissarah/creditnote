// Custom hook for credit note operations in POS
import { useState, useCallback } from 'react';
import { 
  CreditNote, 
  CreditRedemption, 
  ApiResponse, 
  CreditValidationResponse,
  CreditListResponse 
} from '../types/credit.types';
import { parseQRCode, canRedeemCredit } from '../utils/qrcode.utils';
import { validateCreditRedemption } from '../utils/validation.utils';

export interface UseCreditOperationsResult {
  // State
  loading: boolean;
  error: string | null;
  
  // Operations
  validateCredit: (qrCode: string) => Promise<CreditValidationResponse>;
  redeemCredit: (redemption: CreditRedemption) => Promise<ApiResponse<any>>;
  fetchCredits: (customerId?: string, searchQuery?: string) => Promise<CreditListResponse>;
  refreshCreditCache: () => Promise<void>;
  
  // Utilities
  parseQR: (qrString: string) => ReturnType<typeof parseQRCode>;
  validateRedemption: (redemption: CreditRedemption, creditNote?: CreditNote) => ReturnType<typeof validateCreditRedemption>;
}

export function useCreditOperations(): UseCreditOperationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API base URL - will be set based on environment
  const getApiUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://localhost:3000'; // Development fallback
  }, []);

  /**
   * Validate credit note by QR code
   */
  const validateCredit = useCallback(async (qrCode: string): Promise<CreditValidationResponse> => {
    setLoading(true);
    setError(null);

    try {
      // First validate QR format locally
      const qrResult = parseQRCode(qrCode);
      if (!qrResult.isValid) {
        return {
          success: false,
          valid: false,
          error: qrResult.error || 'Invalid QR code format'
        };
      }

      // Call API to validate credit note
      const response = await fetch(`${getApiUrl()}/api/credit-notes/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-POS-Request': 'true'
        },
        body: JSON.stringify({ 
          qrCode: qrResult.data?.code || qrCode,
          qrData: qrResult.data 
        })
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      const data: CreditValidationResponse = await response.json();
      
      if (data.success && data.data) {
        // Additional local validation
        const redemptionCheck = canRedeemCredit(data.data);
        if (!redemptionCheck.canRedeem) {
          return {
            success: false,
            valid: false,
            error: redemptionCheck.reason
          };
        }

        return {
          ...data,
          valid: true,
          usableAmount: redemptionCheck.maxAmount
        };
      }

      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Credit validation failed';
      setError(errorMessage);
      
      return {
        success: false,
        valid: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [getApiUrl]);

  /**
   * Redeem credit note
   */
  const redeemCredit = useCallback(async (redemption: CreditRedemption): Promise<ApiResponse<any>> => {
    setLoading(true);
    setError(null);

    try {
      // Local validation first
      const validation = validateCreditRedemption(redemption);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // Call API to redeem credit
      const response = await fetch(`${getApiUrl()}/api/credit-notes/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-POS-Request': 'true'
        },
        body: JSON.stringify(redemption)
      });

      if (!response.ok) {
        throw new Error(`Redemption failed: ${response.statusText}`);
      }

      const data: ApiResponse<any> = await response.json();
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Credit redemption failed';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [getApiUrl]);

  /**
   * Fetch credit notes for customer or search
   */
  const fetchCredits = useCallback(async (
    customerId?: string, 
    searchQuery?: string
  ): Promise<CreditListResponse> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);
      if (searchQuery) params.append('search', searchQuery);
      params.append('activeOnly', 'true'); // Only fetch active/partially used credits for POS

      const response = await fetch(`${getApiUrl()}/api/credit-notes?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-POS-Request': 'true'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch credits: ${response.statusText}`);
      }

      const data: CreditListResponse = await response.json();
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch credits';
      setError(errorMessage);
      
      return {
        success: false,
        credits: [],
        totalCount: 0,
        hasMore: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [getApiUrl]);

  /**
   * Refresh local credit cache
   */
  const refreshCreditCache = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/credit-notes/refresh-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-POS-Request': 'true'
        }
      });

      if (!response.ok) {
        throw new Error(`Cache refresh failed: ${response.statusText}`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Cache refresh failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [getApiUrl]);

  return {
    loading,
    error,
    validateCredit,
    redeemCredit,
    fetchCredits,
    refreshCreditCache,
    parseQR: parseQRCode,
    validateRedemption: validateCreditRedemption
  };
}