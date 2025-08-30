// QR Code Service - handles QR code generation and validation
import QRCode from 'qrcode';
import { createHash } from 'crypto';

export interface QRCodeData {
  type: 'credit_note';
  version: string;
  code: string;
  amount: number;
  customerId: string;
  shop: string;
  timestamp: string;
  hash?: string;
}

export interface QRValidationResult {
  isValid: boolean;
  data?: QRCodeData;
  error?: string;
}

export class QRCodeService {
  private readonly SECRET_KEY = process.env.QR_SECRET_KEY || 'default-qr-secret';

  /**
   * Generate QR code image from credit note data
   */
  async generateQRImage(data: QRCodeData): Promise<string> {
    try {
      // Add security hash
      const dataWithHash = {
        ...data,
        hash: this.generateHash(data)
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(dataWithHash);

      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(jsonString, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 200
      });

      return qrCodeDataUrl;

    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Validate QR code data and format
   */
  validateQRCode(qrString: string, providedData?: any): QRValidationResult {
    try {
      // Try to parse as JSON first
      const data = JSON.parse(qrString) as QRCodeData;
      
      // Validate required fields
      if (!this.validateRequiredFields(data)) {
        return {
          isValid: false,
          error: 'Missing required QR code fields'
        };
      }

      // Validate type
      if (data.type !== 'credit_note') {
        return {
          isValid: false,
          error: 'Invalid QR code type. Expected credit_note.'
        };
      }

      // Validate amount
      if (typeof data.amount !== 'number' || data.amount <= 0) {
        return {
          isValid: false,
          error: 'Invalid credit amount in QR code'
        };
      }

      // Validate timestamp (not too old for security)
      if (data.timestamp && this.isQRCodeTooOld(data.timestamp)) {
        return {
          isValid: false,
          error: 'QR code has expired. Please generate a new one.'
        };
      }

      // Validate hash if present
      if (data.hash && !this.validateHash(data)) {
        return {
          isValid: false,
          error: 'QR code integrity check failed'
        };
      }

      return {
        isValid: true,
        data
      };

    } catch (error) {
      // Try simple format as fallback
      if (typeof qrString === 'string' && qrString.includes('CREDIT:')) {
        return this.parseSimpleQRFormat(qrString);
      }

      return {
        isValid: false,
        error: 'Invalid QR code format. Unable to parse data.'
      };
    }
  }

  /**
   * Generate QR code for simple text format (backup)
   */
  async generateSimpleQR(creditCode: string, amount: number, customerId: string): Promise<string> {
    try {
      const simpleFormat = `CREDIT:${creditCode}:${amount}:${customerId}:${Date.now()}`;
      
      const qrCodeDataUrl = await QRCode.toDataURL(simpleFormat, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        width: 200
      });

      return qrCodeDataUrl;

    } catch (error) {
      console.error('Error generating simple QR code:', error);
      throw new Error('Failed to generate simple QR code');
    }
  }

  /**
   * Validate required QR code fields
   */
  private validateRequiredFields(data: any): boolean {
    const required = ['type', 'code', 'amount', 'customerId', 'shop', 'timestamp'];
    return required.every(field => data[field] !== undefined && data[field] !== null);
  }

  /**
   * Check if QR code is too old (security measure)
   */
  private isQRCodeTooOld(timestamp: string, maxAgeHours: number = 24): boolean {
    try {
      const qrTime = new Date(timestamp);
      const now = new Date();
      const hoursDiff = (now.getTime() - qrTime.getTime()) / (1000 * 60 * 60);
      
      return hoursDiff > maxAgeHours;
    } catch (error) {
      // If timestamp is invalid, consider it too old
      return true;
    }
  }

  /**
   * Generate security hash for QR code data
   */
  private generateHash(data: QRCodeData): string {
    const { hash, ...dataWithoutHash } = data as any;
    const hashInput = JSON.stringify(dataWithoutHash) + this.SECRET_KEY;
    
    return createHash('sha256')
      .update(hashInput)
      .digest('hex')
      .substring(0, 16); // First 16 characters for brevity
  }

  /**
   * Validate QR code hash
   */
  private validateHash(data: QRCodeData): boolean {
    if (!data.hash) return false;
    
    const expectedHash = this.generateHash(data);
    return data.hash === expectedHash;
  }

  /**
   * Parse simple QR format as fallback
   */
  private parseSimpleQRFormat(qrString: string): QRValidationResult {
    try {
      const parts = qrString.split(':');
      if (parts.length < 4 || parts[0] !== 'CREDIT') {
        return {
          isValid: false,
          error: 'Invalid simple QR format'
        };
      }

      const [, code, amountStr, customerId, timestampStr] = parts;
      const amount = parseFloat(amountStr);

      if (isNaN(amount) || amount <= 0) {
        return {
          isValid: false,
          error: 'Invalid amount in QR code'
        };
      }

      // Check age if timestamp provided
      if (timestampStr && this.isQRCodeTooOld(new Date(parseInt(timestampStr)).toISOString())) {
        return {
          isValid: false,
          error: 'QR code has expired'
        };
      }

      return {
        isValid: true,
        data: {
          type: 'credit_note',
          version: '1.0',
          code,
          amount,
          customerId,
          shop: '', // Will be validated by API
          timestamp: timestampStr ? new Date(parseInt(timestampStr)).toISOString() : new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'Failed to parse simple QR format'
      };
    }
  }

  /**
   * Generate QR code with enhanced security features
   */
  async generateSecureQR(data: QRCodeData, options?: {
    includeShopVerification?: boolean;
    customSize?: number;
    logoUrl?: string;
  }): Promise<string> {
    try {
      // Enhanced data with additional security
      const secureData = {
        ...data,
        hash: this.generateHash(data),
        generated: Date.now(),
        version: '1.1'
      };

      // Add shop verification if requested
      if (options?.includeShopVerification) {
        secureData.shopHash = createHash('md5')
          .update(data.shop + this.SECRET_KEY)
          .digest('hex')
          .substring(0, 8);
      }

      const jsonString = JSON.stringify(secureData);

      // Generate QR code with custom options
      const qrOptions: QRCode.QRCodeToDataURLOptions = {
        errorCorrectionLevel: 'H', // Higher error correction for security
        type: 'image/png',
        quality: 0.95,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff'
        },
        width: options?.customSize || 256
      };

      return await QRCode.toDataURL(jsonString, qrOptions);

    } catch (error) {
      console.error('Error generating secure QR code:', error);
      throw new Error('Failed to generate secure QR code');
    }
  }

  /**
   * Batch generate multiple QR codes
   */
  async generateBatchQRCodes(dataArray: QRCodeData[]): Promise<string[]> {
    const promises = dataArray.map(data => this.generateQRImage(data));
    
    try {
      return await Promise.all(promises);
    } catch (error) {
      console.error('Error generating batch QR codes:', error);
      throw new Error('Failed to generate batch QR codes');
    }
  }

  /**
   * Validate multiple QR codes
   */
  validateBatchQRCodes(qrStrings: string[]): QRValidationResult[] {
    return qrStrings.map(qrString => this.validateQRCode(qrString));
  }
}