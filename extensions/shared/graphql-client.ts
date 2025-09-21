/**
 * Direct GraphQL Client for POS UI Extensions 2025-07
 * Uses Shopify's native authentication - no session tokens required
 */

interface CreditNote {
  id: string;
  noteNumber: string;
  customerName: string;
  customerEmail: string;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
  status: string;
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  updatedAt: string | null;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: any }>;
}

export class DirectGraphQLClient {
  private async makeGraphQLCall<T>(query: string, variables: any = {}): Promise<GraphQLResponse<T>> {
    console.log('[GraphQL Client] Making direct API call...');
    console.log('[GraphQL Client] Query:', query.substring(0, 100) + '...');
    console.log('[GraphQL Client] Variables:', variables);

    try {
      // Direct authenticated call to Shopify Admin GraphQL API
      // Enhanced headers for POS UI Extensions 2025-07 offline mode
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'offline-access', // Offline mode indicator
          'X-Requested-With': 'POS-Extension-2025.07',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[GraphQL Client] ✅ Response received:', {
        hasData: !!result.data,
        hasErrors: !!result.errors,
        errorCount: result.errors?.length || 0
      });

      return result;
    } catch (error) {
      console.error('[GraphQL Client] ❌ Request failed:', error);
      throw error;
    }
  }

  /**
   * Get credit notes from customer metafields
   */
  async getCreditNotes(options: {
    limit?: number;
    search?: string;
  } = {}): Promise<{ success: boolean; data: CreditNote[]; total: number; error?: string }> {
    const { limit = 100, search = '' } = options;

    console.log('[GraphQL Client] Getting credit notes via metafields...');

    try {
      const query = `#graphql
        query GetCreditNotes($first: Int!, $searchQuery: String) {
          customers(first: $first, query: $searchQuery) {
            edges {
              node {
                id
                email
                displayName
                tags
                createdAt
                updatedAt
                metafields(namespace: "credit_system", first: 20) {
                  edges {
                    node {
                      id
                      key
                      value
                      createdAt
                      updatedAt
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
          shop {
            id
            name
            myshopifyDomain
            currencyCode
          }
        }`;

      const searchQuery = search ? `email:*${search}* OR name:*${search}*` : '';
      const variables = {
        first: limit,
        searchQuery: searchQuery || undefined
      };

      const response = await this.makeGraphQLCall<{
        customers: {
          edges: Array<{
            node: {
              id: string;
              email: string;
              displayName: string;
              tags: string[];
              createdAt: string;
              updatedAt: string;
              metafields: {
                edges: Array<{
                  node: {
                    id: string;
                    key: string;
                    value: string;
                    createdAt: string;
                    updatedAt: string;
                  }
                }>
              }
            }
          }>
        };
        shop: {
          id: string;
          name: string;
          myshopifyDomain: string;
          currencyCode: string;
        }
      }>(query, variables);

      if (response.errors) {
        console.error('[GraphQL Client] GraphQL errors:', response.errors);
        return {
          success: false,
          data: [],
          total: 0,
          error: response.errors[0]?.message || 'GraphQL query failed'
        };
      }

      if (!response.data) {
        return {
          success: false,
          data: [],
          total: 0,
          error: 'No data returned from GraphQL'
        };
      }

      // Extract credit notes from customer metafields
      const creditNotes: CreditNote[] = [];

      response.data.customers.edges.forEach(({ node: customer }) => {
        customer.metafields.edges.forEach(({ node: metafield }) => {
          if (metafield.key.startsWith('credit_note_')) {
            try {
              const creditData = JSON.parse(metafield.value);
              creditNotes.push({
                id: metafield.id,
                noteNumber: creditData.noteNumber,
                customerName: customer.displayName || customer.email,
                customerEmail: customer.email,
                originalAmount: creditData.originalAmount,
                remainingAmount: creditData.remainingAmount,
                currency: creditData.currency || response.data.shop.currencyCode,
                status: creditData.status,
                reason: creditData.reason,
                createdAt: metafield.createdAt,
                expiresAt: creditData.expiresAt,
                updatedAt: metafield.updatedAt
              });
            } catch (parseError) {
              console.warn('[GraphQL Client] Failed to parse credit note metafield:', parseError);
            }
          }
        });
      });

      // Sort by creation date (newest first)
      creditNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log('[GraphQL Client] ✅ Successfully extracted credit notes:', {
        totalCustomers: response.data.customers.edges.length,
        totalCreditNotes: creditNotes.length,
        shopDomain: response.data.shop.myshopifyDomain
      });

      return {
        success: true,
        data: creditNotes,
        total: creditNotes.length
      };

    } catch (error) {
      console.error('[GraphQL Client] ❌ Failed to get credit notes:', error);
      return {
        success: false,
        data: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new credit note as customer metafield
   */
  async createCreditNote(creditData: {
    customerEmail: string;
    customerName?: string;
    amount: number;
    currency?: string;
    reason?: string;
    expiresInDays?: number;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log('[GraphQL Client] Creating credit note via metafields...');

    try {
      // First, find or create customer
      const customerQuery = `#graphql
        query FindCustomer($email: String!) {
          customers(first: 1, query: $email) {
            edges {
              node {
                id
                email
                displayName
              }
            }
          }
        }`;

      const customerResponse = await this.makeGraphQLCall<{
        customers: {
          edges: Array<{
            node: {
              id: string;
              email: string;
              displayName: string;
            }
          }>
        }
      }>(customerQuery, { email: `email:${creditData.customerEmail}` });

      let customerId: string;

      if (customerResponse.data?.customers.edges.length > 0) {
        customerId = customerResponse.data.customers.edges[0].node.id;
        console.log('[GraphQL Client] Found existing customer:', customerId);
      } else {
        // Create new customer
        const createCustomerMutation = `#graphql
          mutation CreateCustomer($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer {
                id
                email
                displayName
              }
              userErrors {
                field
                message
              }
            }
          }`;

        const createResponse = await this.makeGraphQLCall<{
          customerCreate: {
            customer: { id: string; email: string; displayName: string };
            userErrors: Array<{ field: string; message: string }>;
          }
        }>(createCustomerMutation, {
          input: {
            email: creditData.customerEmail,
            firstName: creditData.customerName?.split(' ')[0] || '',
            lastName: creditData.customerName?.split(' ').slice(1).join(' ') || '',
            tags: ['credit_customer']
          }
        });

        if (createResponse.data?.customerCreate.userErrors.length > 0) {
          return {
            success: false,
            error: createResponse.data.customerCreate.userErrors[0].message
          };
        }

        customerId = createResponse.data!.customerCreate.customer.id;
        console.log('[GraphQL Client] Created new customer:', customerId);
      }

      // Create credit note metafield
      const noteNumber = this.generateNoteNumber();
      const expiresAt = creditData.expiresInDays
        ? new Date(Date.now() + (creditData.expiresInDays * 24 * 60 * 60 * 1000)).toISOString()
        : null;

      const creditNoteData = {
        noteNumber,
        originalAmount: creditData.amount,
        remainingAmount: creditData.amount,
        currency: creditData.currency || 'USD',
        status: 'active',
        reason: creditData.reason || 'POS Credit Note',
        expiresAt
      };

      const metafieldMutation = `#graphql
        mutation CreateCreditNoteMetafield($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              key
              value
              createdAt
            }
            userErrors {
              field
              message
            }
          }
        }`;

      const metafieldResponse = await this.makeGraphQLCall<{
        metafieldsSet: {
          metafields: Array<{
            id: string;
            key: string;
            value: string;
            createdAt: string;
          }>;
          userErrors: Array<{ field: string; message: string }>;
        }
      }>(metafieldMutation, {
        metafields: [{
          key: `credit_note_${noteNumber}`,
          namespace: 'credit_system',
          ownerId: customerId,
          value: JSON.stringify(creditNoteData),
          type: 'json'
        }]
      });

      if (metafieldResponse.data?.metafieldsSet.userErrors.length > 0) {
        return {
          success: false,
          error: metafieldResponse.data.metafieldsSet.userErrors[0].message
        };
      }

      console.log('[GraphQL Client] ✅ Credit note created successfully:', noteNumber);

      return {
        success: true,
        data: {
          noteNumber,
          amount: creditData.amount,
          expiresAt,
          metafieldId: metafieldResponse.data!.metafieldsSet.metafields[0].id
        }
      };

    } catch (error) {
      console.error('[GraphQL Client] ❌ Failed to create credit note:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private generateNoteNumber(): string {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CN-${year}-${randomSuffix}`;
  }

  /**
   * Check if direct GraphQL API is available by testing a simple query
   */
  static async isAvailable(): Promise<boolean> {
    try {
      console.log('[GraphQL Client] Testing direct API availability...');

      // Test with a minimal shop query
      const testQuery = `#graphql
        query TestConnection {
          shop {
            id
            name
          }
        }`;

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: testQuery
        })
      });

      const result = await response.json();

      // Check if we got a valid response (even with errors, means endpoint is accessible)
      const available = response.ok && (result.data || result.errors);

      console.log('[GraphQL Client] Direct API test result:', {
        status: response.status,
        available,
        hasData: !!result.data,
        hasErrors: !!result.errors,
        shopId: result.data?.shop?.id
      });

      return available;
    } catch (error) {
      console.log('[GraphQL Client] Direct API not available:', error);
      return false;
    }
  }

  /**
   * Synchronous availability check for environments where async detection isn't feasible
   */
  static isLikelyAvailable(): boolean {
    try {
      // Basic environment check - this is a fallback
      return typeof fetch !== 'undefined' &&
             typeof window !== 'undefined';
    } catch {
      return false;
    }
  }
}