import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function onboard(page: Page, picks = ["Music", "Math", "Food"]) {
  await page.goto("/");
  const next = page.getByRole("button", { name: /Pick at least 3/ });
  await expect(next).toBeDisabled();
  for (const c of picks) await page.getByRole("button", { name: c, exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
}

test("onboarding needs three interests, then the tour walks through three steps", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What are you curious about?" })).toBeVisible();
  await page.getByRole("button", { name: "Music", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pick at least 3 (1/3)" })).toBeDisabled();
  await page.getByRole("button", { name: "Math", exact: true }).click();
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Tap an underlined phrase to read about it.")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Highlight any text to ask Birdie about it.")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Tap the search icon to read about anything.")).toBeVisible();
  await page.getByRole("button", { name: "Start reading" }).click();
  await expect(page.locator("[data-article]").first()).toBeVisible();

  // Returning visit skips onboarding and opens straight onto a topic.
  await page.reload();
  await expect(page.locator("[data-article]").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "What are you curious about?" })).toHaveCount(0);
});

test("feed article has dotted openings, a peek, and Next, maybe nudges", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const article = page.locator("[data-article]").first();
  const openings = article.locator("a.opening");
  expect(await openings.count()).toBeGreaterThanOrEqual(4);

  await openings.first().click();
  const peek = page.getByRole("dialog");
  await expect(peek.getByRole("button", { name: "Read", exact: true })).toBeVisible();
  await expect(peek.getByRole("button", { name: /Save for later/ })).toBeVisible();
  await peek.getByRole("button", { name: /Save for later/ }).click();
  await expect(peek.getByRole("button", { name: "Saved" })).toBeVisible();
  await peek.getByRole("button", { name: "Read", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  const nudges = page.getByRole("region", { name: "Next, maybe" }).first();
  await nudges.scrollIntoViewIfNeeded();
  await expect(nudges.getByRole("button")).toHaveCount(3);
});

test("highlighting text offers Ask Birdie and opens a streaming chat", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.evaluate(() => {
    const p = document.querySelector('[data-tour="lede"]')!;
    const t = p.firstChild as Text;
    const r = document.createRange();
    r.setStart(t, 0);
    r.setEnd(t, Math.min(60, t.length));
    const s = getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  });
  await page.getByRole("button", { name: "Ask Birdie" }).click();
  await page.getByRole("button", { name: "Why?" }).click();
  await expect(page.getByText(/demo mode/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("READ NEXT")).toBeVisible({ timeout: 15_000 });
});

test("search writes an article for exactly the words typed", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.getByRole("button", { name: "Search" }).first().click();
  await page.locator("#search-input").fill("Massachusetts");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Massachusetts", level: 1 })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
  // A corpus title resolves to the built-in topic instead of being rewritten.
  await page.getByRole("button", { name: "Search" }).first().click();
  await page.locator("#search-input").fill("Tulip mania");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Tulip mania", level: 1 })).toBeVisible();
});

test("reading settings switch theme and text size, and persist", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.getByRole("button", { name: "Reading settings" }).first().click();
  await page.getByRole("radio", { name: /Sepia/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reader-theme", "sepia");
  await page.getByRole("button", { name: "Larger text" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-reader-theme", "sepia");
  const size = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--read-size"));
  expect(size.trim()).toBe("20px");
});

test("the back button closes sheets and pops pages without leaving the app", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const article = page.locator("[data-article]").first();
  const title = await article.locator("h1").innerText();

  // Back closes a sheet and stays on the feed.
  await page.getByRole("button", { name: "Reading settings" }).first().click();
  await expect(page.getByRole("radio", { name: /Sepia/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("radio", { name: /Sepia/ })).toHaveCount(0);
  await expect(page.locator("[data-article] h1").first()).toHaveText(title);

  // Peek → Read pushes a page; back returns to the feed; back again does nothing harmful.
  await article.locator("a.opening").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Read", exact: true }).click();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(page.locator("[data-article] h1").first()).toHaveText(title);

  // In-app back after a sheet on a pushed page also lands on the feed.
  await article.locator("a.opening").nth(1).click();
  await page.getByRole("dialog").getByRole("button", { name: "Read", exact: true }).click();
  await page.getByRole("button", { name: "Reading settings" }).first().click();
  await page.goBack();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(page).toHaveURL(/127\.0\.0\.1:5199\/?$/);
});

test("rapid close → pop → search push keeps history and the stack in sync", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const article = page.locator("[data-article]").first();
  await article.locator("a.opening").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Read", exact: true }).click();
  await page.getByRole("button", { name: "Reading settings" }).first().click();
  // No waits between steps: queued history pops must not swallow the next push.
  await page.goBack();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Search" }).first().click();
  await page.locator("#search-input").fill("Tulip mania");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Tulip mania", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(page.locator("#search-input")).toHaveCount(0);
});

test("no WCAG A/AA violations on the feed in all three themes", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  for (const theme of ["Dark", "Sepia", "Light"]) {
    await page.getByRole("button", { name: "Reading settings" }).first().click();
    await page.getByRole("radio", { name: new RegExp(theme) }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${theme}: ${v.id}`)).toEqual([]);
  }
});
