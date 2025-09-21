/**
 * Metafield Synchronization for POS UI Extensions
 * Ensures credit notes are accessible via GraphQL metafields
 */

interface CreditNoteData {
  noteNumber: string;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
  status: string;
  reason: string;
  expiresAt?: string | null;
  qrCode?: string;
}

interface CustomerMetafieldInput {
  customerId: string;
  creditNoteData: CreditNoteData;
  shopifyAdmin: any;
}

export class MetafieldSyncService {
  /**
   * Creates a customer metafield for a credit note
   * This enables GraphQL access for POS UI extensions
   */
  static async createCreditNoteMetafield({
    customerId,
    creditNoteData,
    shopifyAdmin
  }: CustomerMetafieldInput): Promise<{ success: boolean; metafieldId?: string; error?: string }> {
    console.log('[Metafield Sync] Creating metafield for credit note:', creditNoteData.noteNumber);

    try {
      // Convert customerId to GraphQL ID format if needed
      const customerGid = customerId.startsWith('gid://shopify/Customer/')
        ? customerId
        : `gid://shopify/Customer/${customerId}`;

      const metafieldKey = `credit_note_${creditNoteData.noteNumber}`;
      const metafieldValue = JSON.stringify(creditNoteData);

      console.log('[Metafield Sync] Creating metafield:', {
        customerGid,
        key: metafieldKey,
        valueLength: metafieldValue.length
      });

      // Create metafield using Shopify Admin API
      const mutation = `#graphql
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

      const variables = {
        metafields: [{
          key: metafieldKey,
          namespace: 'credit_system',
          ownerId: customerGid,
          value: metafieldValue,
          type: 'json'
        }]
      };

      const response = await shopifyAdmin.graphql(mutation, { variables });
      const result = await response.json();

      if (result.errors) {
        console.error('[Metafield Sync] GraphQL errors:', result.errors);
        return {
          success: false,
          error: result.errors[0]?.message || 'GraphQL error occurred'
        };
      }

      const metafieldsSet = result.data?.metafieldsSet;
      if (metafieldsSet?.userErrors?.length > 0) {
        console.error('[Metafield Sync] User errors:', metafieldsSet.userErrors);
        return {
          success: false,
          error: metafieldsSet.userErrors[0].message
        };
      }

      const metafield = metafieldsSet?.metafields?.[0];
      if (!metafield) {
        return {
          success: false,
          error: 'No metafield returned from API'
        };
      }

      console.log('[Metafield Sync] ✅ Metafield created successfully:', {
        id: metafield.id,
        key: metafield.key,
        createdAt: metafield.createdAt
      });

      return {
        success: true,
        metafieldId: metafield.id
      };

    } catch (error) {
      console.error('[Metafield Sync] ❌ Failed to create metafield:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Updates an existing credit note metafield
   */
  static async updateCreditNoteMetafield({
    customerId,
    creditNoteData,
    shopifyAdmin
  }: CustomerMetafieldInput): Promise<{ success: boolean; error?: string }> {
    console.log('[Metafield Sync] Updating metafield for credit note:', creditNoteData.noteNumber);

    try {
      // For updates, we first delete the old metafield and create a new one
      // This is simpler than finding the exact metafield ID
      const deleteResult = await this.deleteCreditNoteMetafield({
        customerId,
        noteNumber: creditNoteData.noteNumber,
        shopifyAdmin
      });

      // Create new metafield regardless of delete result
      const createResult = await this.createCreditNoteMetafield({
        customerId,
        creditNoteData,
        shopifyAdmin
      });

      return createResult;

    } catch (error) {
      console.error('[Metafield Sync] ❌ Failed to update metafield:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deletes a credit note metafield
   */
  static async deleteCreditNoteMetafield({
    customerId,
    noteNumber,
    shopifyAdmin
  }: {
    customerId: string;
    noteNumber: string;
    shopifyAdmin: any;
  }): Promise<{ success: boolean; error?: string }> {
    console.log('[Metafield Sync] Deleting metafield for credit note:', noteNumber);

    try {
      const customerGid = customerId.startsWith('gid://shopify/Customer/')
        ? customerId
        : `gid://shopify/Customer/${customerId}`;

      // First, find the metafield
      const query = `#graphql
        query FindCreditNoteMetafield($customerId: ID!, $namespace: String!, $key: String!) {
          customer(id: $customerId) {
            metafield(namespace: $namespace, key: $key) {
              id
            }
          }
        }`;

      const queryResponse = await shopifyAdmin.graphql(query, {
        variables: {
          customerId: customerGid,
          namespace: 'credit_system',
          key: `credit_note_${noteNumber}`
        }
      });

      const queryResult = await queryResponse.json();
      const metafieldId = queryResult.data?.customer?.metafield?.id;

      if (!metafieldId) {
        console.log('[Metafield Sync] No metafield found to delete');
        return { success: true };
      }

      // Delete the metafield
      const deleteMutation = `#graphql
        mutation DeleteMetafield($input: MetafieldDeleteInput!) {
          metafieldDelete(input: $input) {
            deletedId
            userErrors {
              field
              message
            }
          }
        }`;

      const deleteResponse = await shopifyAdmin.graphql(deleteMutation, {
        variables: {
          input: {
            id: metafieldId
          }
        }
      });

      const deleteResult = await deleteResponse.json();

      if (deleteResult.data?.metafieldDelete?.userErrors?.length > 0) {
        console.error('[Metafield Sync] Delete errors:', deleteResult.data.metafieldDelete.userErrors);
        return {
          success: false,
          error: deleteResult.data.metafieldDelete.userErrors[0].message
        };
      }

      console.log('[Metafield Sync] ✅ Metafield deleted successfully:', metafieldId);
      return { success: true };

    } catch (error) {
      console.error('[Metafield Sync] ❌ Failed to delete metafield:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Migrates existing credit notes to metafields
   * This is useful for syncing historical data
   */
  static async migrateExistingCreditNotes(
    shopifyAdmin: any,
    shopDomain: string,
    limit: number = 100
  ): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    console.log('[Metafield Sync] Starting migration of existing credit notes...');

    try {
      // This would need to be implemented based on your specific migration needs
      // For now, returning a placeholder
      console.log('[Metafield Sync] Migration not yet implemented');

      return {
        success: true,
        migrated: 0,
        errors: ['Migration not yet implemented']
      };

    } catch (error) {
      console.error('[Metafield Sync] ❌ Migration failed:', error);
      return {
        success: false,
        migrated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
}