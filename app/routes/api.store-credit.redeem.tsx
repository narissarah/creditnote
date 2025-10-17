import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const STORE_CREDIT_DEBIT_MUTATION = `
  mutation storeCreditAccountDebit($id: ID!, $debitInput: StoreCreditAccountDebitInput!) {
    storeCreditAccountDebit(id: $id, debitInput: $debitInput) {
      storeCreditAccountTransaction {
        amount {
          amount
          currencyCode
        }
        account {
          id
          balance {
            amount
            currencyCode
          }
          owner {
            ... on Customer {
              id
              displayName
              email
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.public.appProxy(request);

    const body = await request.json();
    const { qrCode, amount } = body;

    if (!qrCode) {
      return json({ success: false, error: 'QR code is required' }, { status: 400 });
    }

    // Decode QR code payload
    let payload;
    try {
      const decoded = atob(qrCode);
      payload = JSON.parse(decoded);
    } catch (error) {
      return json({ success: false, error: 'Invalid QR code format' }, { status: 400 });
    }

    if (payload.type !== 'store_credit') {
      return json({ success: false, error: 'Invalid QR code type' }, { status: 400 });
    }

    // Use amount from request or from QR code
    const debitAmount = amount || payload.amount;

    if (!debitAmount || parseFloat(debitAmount) <= 0) {
      return json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    // Debit store credit using Shopify Admin API
    const response = await admin.graphql(STORE_CREDIT_DEBIT_MUTATION, {
      variables: {
        id: payload.customerId,
        debitInput: {
          debitAmount: {
            amount: debitAmount.toString(),
            currencyCode: payload.currency || 'USD',
          },
        },
      },
    });

    const result = await response.json();

    if (result.data?.storeCreditAccountDebit?.userErrors?.length > 0) {
      const errors = result.data.storeCreditAccountDebit.userErrors
        .map((err: { message: string }) => err.message)
        .join(', ');
      return json({ success: false, error: errors }, { status: 400 });
    }

    if (!result.data?.storeCreditAccountDebit?.storeCreditAccountTransaction) {
      return json({ success: false, error: 'Failed to debit store credit' }, { status: 500 });
    }

    const transaction = result.data.storeCreditAccountDebit.storeCreditAccountTransaction;

    return json({
      success: true,
      amount: `${transaction.amount.amount} ${transaction.amount.currencyCode}`,
      balance: `${transaction.account.balance.amount} ${transaction.account.balance.currencyCode}`,
      customer: {
        id: transaction.account.owner.id,
        name: transaction.account.owner.displayName,
        email: transaction.account.owner.email,
      },
    });
  } catch (error) {
    console.error('[STORE_CREDIT_REDEEM] Error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
