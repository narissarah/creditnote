import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  BlockStack,
  Text,
  Banner,
  InlineStack,
  Checkbox,
  Divider,
  List,
} from "@shopify/polaris";
import prisma from "../db.server";

interface ShopSettings {
  shopDomain: string;
  currency: string;
  creditPrefix: string;
  autoExpireDays: number | null;
  emailNotifications: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  let settings = await prisma.shopSettings.findUnique({
    where: { shopDomain: session.shop }
  });
  
  // Create default settings if none exist
  if (!settings) {
    settings = await prisma.shopSettings.create({
      data: {
        shopDomain: session.shop,
        currency: "USD",
        creditPrefix: "CN-",
        autoExpireDays: 365,
        emailNotifications: true
      }
    });
  }
  
  return json({ settings });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const currency = formData.get("currency") as string;
  const creditPrefix = formData.get("creditPrefix") as string;
  const autoExpireDays = formData.get("autoExpireDays") ? 
    parseInt(formData.get("autoExpireDays") as string) : null;
  const emailNotifications = formData.get("emailNotifications") === "true";
  
  const settings = await prisma.shopSettings.upsert({
    where: { shopDomain: session.shop },
    update: {
      currency,
      creditPrefix,
      autoExpireDays,
      emailNotifications
    },
    create: {
      shopDomain: session.shop,
      currency,
      creditPrefix,
      autoExpireDays,
      emailNotifications
    }
  });
  
  return json({ success: true, settings });
}

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  
  const [currency, setCurrency] = useState(settings.currency);
  const [creditPrefix, setCreditPrefix] = useState(settings.creditPrefix);
  const [autoExpireDays, setAutoExpireDays] = useState(
    settings.autoExpireDays?.toString() || ""
  );
  const [emailNotifications, setEmailNotifications] = useState(
    settings.emailNotifications
  );
  const [saved, setSaved] = useState(false);
  
  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("currency", currency);
    formData.append("creditPrefix", creditPrefix);
    formData.append("autoExpireDays", autoExpireDays);
    formData.append("emailNotifications", emailNotifications.toString());
    
    submit(formData, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [currency, creditPrefix, autoExpireDays, emailNotifications, submit]);
  
  const currencyOptions = [
    { label: "US Dollar (USD)", value: "USD" },
    { label: "Canadian Dollar (CAD)", value: "CAD" },
    { label: "Euro (EUR)", value: "EUR" },
    { label: "British Pound (GBP)", value: "GBP" },
    { label: "Australian Dollar (AUD)", value: "AUD" },
  ];
  
  return (
    <Page 
      title="Settings"
      breadcrumbs={[{ content: "Credit Notes", url: "/app" }]}
    >
      {/* FRAME CONTEXT FIX: Replace Layout with InlineStack for two-column layout */}
      <InlineStack gap="600" alignment="start">
        <div style={{ flex: 2 }}>
          {saved && (
            <Banner tone="success">
              Settings saved successfully!
            </Banner>
          )}

          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  General Settings
                </Text>

                <FormLayout>
                  <Select
                    label="Default Currency"
                    options={currencyOptions}
                    value={currency}
                    onChange={setCurrency}
                    helpText="The default currency for new credit notes"
                  />

                  <TextField
                    label="Credit Note Prefix"
                    value={creditPrefix}
                    onChange={setCreditPrefix}
                    placeholder="CN-"
                    helpText="Prefix for credit note numbers (e.g., CN-2024-0001)"
                    autoComplete="off"
                  />

                  <TextField
                    label="Auto-expire Days"
                    type="number"
                    value={autoExpireDays}
                    onChange={setAutoExpireDays}
                    placeholder="365"
                    helpText="Number of days before credit notes expire (leave empty for no expiration)"
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Notifications
                </Text>

                <Checkbox
                  label="Email notifications"
                  helpText="Send email notifications when credit notes are created or redeemed"
                  checked={emailNotifications}
                  onChange={setEmailNotifications}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  POS Integration
                </Text>

                <Text variant="bodyMd" tone="subdued">
                  Credit notes can be scanned and redeemed in Shopify POS using the integrated extension.
                </Text>

                <BlockStack gap="200">
                  <InlineStack alignment="space-between">
                    <Text>POS Extension Status:</Text>
                    <Text fontWeight="semibold" tone="success">Active</Text>
                  </InlineStack>

                  <InlineStack alignment="space-between">
                    <Text>QR Code Generation:</Text>
                    <Text fontWeight="semibold" tone="success">Enabled</Text>
                  </InlineStack>

                  <InlineStack alignment="space-between">
                    <Text>Offline Support:</Text>
                    <Text fontWeight="semibold" tone="success">Available</Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            <InlineStack gap="300">
              <Button variant="primary" onClick={handleSave}>
                Save Settings
              </Button>
            </InlineStack>
          </BlockStack>
        </div>

        <div style={{ flex: 1 }}>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                About Credit Notes
              </Text>

              <Text variant="bodyMd" tone="subdued">
                This app allows you to create and manage store credit notes for your customers.
              </Text>

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm">Features:</Text>
                <List>
                  <List.Item>Create credit notes for returns</List.Item>
                  <List.Item>QR codes for easy POS redemption</List.Item>
                  <List.Item>Track partial redemptions</List.Item>
                  <List.Item>Automatic expiration handling</List.Item>
                  <List.Item>Offline POS support</List.Item>
                </List>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm">Quick Stats:</Text>
                <Text variant="bodySm" tone="subdued">
                  View your credit note statistics on the main dashboard.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </div>
      </InlineStack>
    </Page>
  );
}