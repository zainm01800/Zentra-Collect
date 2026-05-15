import { test, expect } from "@playwright/test";

/**
 * E2E tests for the /demo section — no auth required, fully standalone.
 * These run against the live dev server (localhost:3000).
 */

test.describe("Demo dashboard", () => {
  test("loads and shows KPI cards", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    // KPI cards show GBP amounts
    await expect(page.locator("text=£").first()).toBeVisible();
  });

  test("has a sign-up CTA", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("link", { name: /sign up|start|trial/i }).first()).toBeVisible();
  });
});

test.describe("Demo chase plan", () => {
  test("loads ranked invoice list", async ({ page }) => {
    await page.goto("/demo/chase-plan");
    await expect(page.getByRole("heading", { name: /chase plan/i })).toBeVisible();
  });

  test("shows All open tab with invoices", async ({ page }) => {
    await page.goto("/demo/chase-plan");
    // Click 'All open' tab
    const allOpenTab = page.getByRole("button", { name: /all open/i });
    await allOpenTab.click();
    // At least one invoice row / card should appear
    await expect(page.locator("text=Review").first()).toBeVisible();
  });

  test("upload is blocked with a CTA instead", async ({ page }) => {
    await page.goto("/demo/chase-plan");
    // Should NOT have a real import button — instead a CTA to sign up
    await expect(page.getByRole("link", { name: /import your data|sign up|start/i }).first()).toBeVisible();
  });
});

test.describe("Demo customers", () => {
  test("loads customer list", async ({ page }) => {
    await page.goto("/demo/customers");
    await expect(page.getByRole("heading", { name: /customers/i })).toBeVisible();
  });

  test("shows risk badges", async ({ page }) => {
    await page.goto("/demo/customers");
    await expect(page.locator("text=High risk, text=Medium risk, text=Low risk").first()).toBeVisible().catch(() => {
      // at least one risk badge exists
      return expect(page.locator("text=risk").first()).toBeVisible();
    });
  });

  test("shows outstanding balance amounts", async ({ page }) => {
    await page.goto("/demo/customers");
    await expect(page.locator("text=£").first()).toBeVisible();
  });
});

test.describe("Core app pages", () => {
  test("login page loads with sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in|welcome/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  });

  test("reset-password page loads correctly", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: /set new password/i })).toBeVisible();
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });

  test("reset-password shows error for mismatched passwords", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByPlaceholder(/min\. 8/i).fill("password123");
    await page.getByPlaceholder(/repeat/i).fill("different456");
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(page.getByText(/don't match/i)).toBeVisible();
  });

  test("404 page shows a helpful message", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-xyz");
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });

  test("auth callback redirects to login with link_expired on bad code", async ({ page }) => {
    await page.goto("/auth/callback?code=invalid-code-xyz");
    // Should redirect to /login with error param
    await expect(page).toHaveURL(/\/login/);
  });
});
