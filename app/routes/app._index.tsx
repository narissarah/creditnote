import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, IndexTable, Button, Badge,
  TextField, FormLayout, Text, EmptyState, Box, BlockStack,
  InlineStack, Banner, DropZone, Thumbnail,
  Icon, useBreakpoints
} from "@shopify/polaris";
import { 
  ImageIcon, 
  TextIcon, 
  SearchIcon
} from "@shopify/polaris-icons";
import { Html5Qrcode } from "html5-qrcode";
import prisma from "../db.server";
import { Prisma } from '@prisma/client';
import { sanitizeString, sanitizeEmail, sanitizeNumber } from "../utils/sanitize.server";

interface CreditNote {
  id: string;
  customerId: string;
  customerName: string;
  originalAmount: string;
  remainingAmount: string;
  status: string;
  qrCode: string | null;
  shopDomain: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  try {
    
    // Add pagination support with query params
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const skip = (page - 1) * limit;
    
    const [credits, totalCount] = await Promise.all([
      prisma.creditNote.findMany({
        where: {
          OR: [
            { shop: session.shop },
            { shopDomain: session.shop }
          ],
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: skip,
      }),
      prisma.creditNote.count({
        where: {
          OR: [
            { shop: session.shop },
            { shopDomain: session.shop }
          ],
          deletedAt: null
        }
      })
    ]);
    
    const serializedCredits = credits.map(credit => ({
      id: credit.id,
      customerId: credit.customerId,
      customerName: credit.customerName || "",
      originalAmount: credit.originalAmount.toString(),
      remainingAmount: credit.remainingAmount.toString(),
      status: credit.status,
      qrCode: credit.qrCode,
      shopDomain: credit.shopDomain,
      createdAt: credit.createdAt.toISOString(),
      updatedAt: credit.updatedAt.toISOString(),
      expiresAt: credit.expiresAt?.toISOString() || null,
    }));
    
    return json({ 
      credits: serializedCredits,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error("[ADMIN LOADER] Critical error:", error);
    console.error("[ADMIN LOADER] Error stack:", error instanceof Error ? error.stack : "No stack");
    return json({
      credits: [],
      error: "Admin interface temporarily unavailable",
      debugInfo: error instanceof Error ? error.message : "Unknown error",
      pagination: { page: 1, limit: 50, totalCount: 0, totalPages: 0 }
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const action = formData.get("action");
  
    if (action === "create") {
      // Sanitize inputs to prevent XSS
      const customerName = sanitizeString(formData.get("customerName") as string);
      const amount = sanitizeNumber(formData.get("amount") as string);
      const customerEmailRaw = formData.get("customerEmail") as string;
      const customerEmail = customerEmailRaw ? sanitizeEmail(customerEmailRaw) : "";
      const expiresInDays = sanitizeNumber(formData.get("expiresInDays") as string || "0");
      
      if (!customerName || !amount || amount <= 0) {
        return json({ error: "Invalid input data" }, { status: 400 });
      }
      
      const timestamp = Date.now();

      const expiresAt = expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const customerId = customerEmail ?
        `email-${customerEmail.replace(/[^a-zA-Z0-9]/g, '-')}` :
        `temp-${timestamp.toString().slice(-8)}`;

      // FIXED: Use Prisma.Decimal for amount fields and let ID auto-generate
      const credit = await prisma.creditNote.create({
        data: {
          customerId,
          customerName,
          originalAmount: new Prisma.Decimal(amount),
          remainingAmount: new Prisma.Decimal(amount),
          currency: "CAD",
          shopDomain: session.shop,
          shop: session.shop,  // FIXED: Set both fields for compatibility
          qrCode: JSON.stringify({
            customerId,
            amount,
            shop: session.shop,
            timestamp
          }),
          metafieldId: null,
          expiresAt,
          status: 'active'  // FIXED: Set default status
        }
      });
      
      return json({ success: true, credit });
    }
  
    if (action === "delete") {
      const creditId = formData.get("creditId") as string;
      
      await prisma.creditNote.update({
        where: { id: creditId },
        data: { deletedAt: new Date() }
      });
      
      return json({ success: true });
    }
  
    if (action === "redeem") {
      const creditId = formData.get("creditId") as string;
      const amount = parseFloat(formData.get("amount") as string);
      const orderId = formData.get("orderId") as string || `order_${Date.now()}`;
      
      const credit = await prisma.creditNote.findUnique({
        where: { id: creditId }
      });
      
      if (!credit) {
        return json({ error: "Credit not found" }, { status: 404 });
      }
      
      // Check if credit is expired
      if (credit.expiresAt && credit.expiresAt < new Date()) {
        return json({ error: "Credit has expired" }, { status: 400 });
      }
      
      const remainingAmount = parseFloat(credit.remainingAmount.toString()) - amount;

      if (remainingAmount < 0) {
        return json({ error: "Insufficient credit balance" }, { status: 400 });
      }

      // FIXED: Use Prisma.Decimal for decimal fields
      await prisma.$transaction([
        prisma.creditNote.update({
          where: { id: creditId },
          data: {
            remainingAmount: new Prisma.Decimal(remainingAmount),
            status: remainingAmount === 0 ? "fully_used" : "active"
          }
        }),
        prisma.creditRedemption.create({
          data: {
            creditNoteId: creditId,
            orderId,
            amount: new Prisma.Decimal(amount)
          }
        })
      ]);
      
      return json({ success: true, remainingAmount });
    }
  
    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Action error:", error);
    return json({ error: "An error occurred processing your request" }, { status: 500 });
  }
}

export default function Credits() {
  const data = useLoaderData<typeof loader>();
  const breakpoints = useBreakpoints();
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  
  // Use nullish coalescing to avoid hydration mismatch
  const isMobile = breakpoints?.smDown ?? false;
  
  const isSubmitting = navigation.state === "submitting";
  const isCreating = isSubmitting && navigation.formData?.get("action") === "create";
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [redeemModalOpen, setRedeemModalOpen] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditNote | null>(null);
  const [scannedCreditId, setScannedCreditId] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [bannerActive, setBannerActive] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'file' | 'manual'>('file');
  const [isScanning, setIsScanning] = useState(false);
  const [manualCreditId, setManualCreditId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("0");
  
  useEffect(() => {
    if (fetcher.data?.success && fetcher.state === "idle") {
      setBannerMessage("Credit note created successfully!");
      setBannerActive(true);
      setCreateModalOpen(false);
      setCustomerName("");
      setAmount("");
      setCustomerEmail("");
      setExpiresInDays("0");
      // Auto-hide banner after 5 seconds
      setTimeout(() => setBannerActive(false), 5000);
    }
  }, [fetcher.data, fetcher.state]);
  
  const handleCreateCredit = useCallback(() => {
    const formData = new FormData();
    formData.append("action", "create");
    formData.append("customerName", customerName);
    formData.append("amount", amount);
    formData.append("customerEmail", customerEmail);
    formData.append("expiresInDays", expiresInDays);
    
    fetcher.submit(formData, { method: "post" });
  }, [customerName, amount, customerEmail, expiresInDays, fetcher]);
  
  const handleDeleteCredit = useCallback((creditId: string) => {
    if (confirm("Are you sure you want to delete this credit note?")) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("creditId", creditId);
      submit(formData, { method: "post" });
    }
  }, [submit]);
  
  const resourceName = {
    singular: 'credit note',
    plural: 'credit notes',
  };
  
  // Filter credits based on search query
  const filteredCredits = data.credits.filter(credit => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      credit.customerName.toLowerCase().includes(query) ||
      credit.id.toLowerCase().includes(query) ||
      credit.customerId.toLowerCase().includes(query)
    );
  });
  
  // Show error if there's an issue with loading (after all hooks are declared)
  if ('error' in data && data.error) {
    return (
      <Page title="Credit Notes">
        <Card>
          <Banner tone="critical">
            <p>Unable to load credit notes: {data.error}</p>
            <p>Please refresh the page or contact support if the issue persists.</p>
          </Banner>
        </Card>
      </Page>
    );
  }
  
  const rowMarkup = filteredCredits.map(
    (credit, index) => {
      // Check expiration consistently on both server and client (creditcraft pattern)
      const isExpired = credit.expiresAt && new Date(credit.expiresAt) < new Date();
      
      return (
        <IndexTable.Row
          id={credit.id}
          key={credit.id}
          position={index}
        >
          <IndexTable.Cell>
            <Text variant="bodySm" fontWeight="semibold">
              {credit.id}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd">
              {credit.customerName}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <div style={{ textAlign: 'right' }}>
              <Text variant="bodyMd" fontWeight="semibold">
                ${parseFloat(credit.remainingAmount).toFixed(2)}
              </Text>
            </div>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge 
              tone={
                isExpired ? "critical" : 
                credit.status === "active" ? "success" : 
                credit.status === "fully_used" ? "info" :
                "default"
              }
              size="small"
            >
              {isExpired ? "Expired" : credit.status}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="200">
              <Button 
                size="slim"
                onClick={() => handleDeleteCredit(credit.id)}
                tone="critical"
                accessibilityLabel={`Delete credit ${credit.id}`}
              >
                Delete
              </Button>
            </InlineStack>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );
  
  const emptyStateMarkup = (
    <EmptyState
      heading="Create your first credit note"
      action={{
        content: 'Create Credit Note', 
        onAction: () => setCreateModalOpen(true),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Start issuing store credits to your customers.</p>
    </EmptyState>
  );
  
  return (
    <Page
      title="Credit Notes"
      primaryAction={{
        content: "Create Credit Note",
        onAction: () => setCreateModalOpen(true),
        loading: isCreating,
      }}
    >
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <TextField
                  label="Search credit notes"
                  labelHidden
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by customer name or credit ID"
                  clearButton
                  onClearButtonClick={() => setSearchQuery("")}
                  autoComplete="off"
                  prefix={<Icon source={SearchIcon} />}
                />
              </Card>
              <Card padding="0">
              {filteredCredits.length === 0 && searchQuery ? (
                <EmptyState
                  heading="No results found"
                  action={{
                    content: 'Clear search',
                    onAction: () => setSearchQuery(""),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Try searching with different keywords.</p>
                </EmptyState>
              ) : data.credits.length === 0 ? (
                emptyStateMarkup
              ) : (
                <IndexTable
                  condensed={isMobile}
                  resourceName={resourceName}
                  itemCount={filteredCredits.length}
                  selectable={false}
                  headings={[
                    {title: 'Credit ID'},
                    {title: 'Customer'},
                    {title: 'Balance', alignment: 'end'},
                    {title: 'Status'},
                    {title: 'Actions', alignment: 'end'},
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              )}
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
        
        {createModalOpen && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Create Credit Note</Text>
                  <Button
                    plain
                    onClick={() => setCreateModalOpen(false)}
                    accessibilityLabel="Close create form"
                  >
                    ✕
                  </Button>
                </InlineStack>

                <FormLayout>
                  <TextField
                    label="Customer Name"
                    value={customerName}
                    onChange={setCustomerName}
                    autoComplete="off"
                    requiredIndicator
                  />
                  <TextField
                    label="Amount (CAD)"
                    type="number"
                    value={amount}
                    onChange={setAmount}
                    autoComplete="off"
                    prefix="$"
                    min="0.01"
                    step="0.01"
                    requiredIndicator
                  />
                  <TextField
                    label="Customer Email (Optional)"
                    type="email"
                    value={customerEmail}
                    onChange={setCustomerEmail}
                    autoComplete="off"
                  />
                  <TextField
                    label="Expires in (days)"
                    type="number"
                    value={expiresInDays}
                    onChange={setExpiresInDays}
                    autoComplete="off"
                    min="0"
                    helpText="Enter 0 for no expiration"
                  />
                </FormLayout>

                <InlineStack gap="200">
                  <Button
                    variant="primary"
                    onClick={handleCreateCredit}
                    disabled={!customerName || !amount || parseFloat(amount) <= 0}
                    loading={isCreating}
                  >
                    Create
                  </Button>
                  <Button
                    onClick={() => setCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
        
        {bannerActive && (
          <Banner
            title={bannerMessage}
            tone="success"
            onDismiss={() => setBannerActive(false)}
          />
        )}
      </Page>
  );
}