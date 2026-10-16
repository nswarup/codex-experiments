import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function onboard(page: Page, picks = ["Music", "Math", "Food"]) {
  await page.goto("/");
  const next = page.getByRole("button", { name: "Continue" });
  await expect(next).toBeDisabled();
  for (const c of picks) await page.getByRole("button", { name: c, exact: true }).click();
  await next.click();
}

test("onboarding needs three interests, then the tour walks through three steps", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My favorite topics" })).toBeVisible();
  await expect(page.getByText("Pick 3 or more.")).toBeVisible();
  await page.getByRole("button", { name: "Music", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.getByText("1 selected. Pick 2 more.")).toBeAttached();
  await page.getByRole("button", { name: "Math", exact: true }).click();
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

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
  await expect(page.getByRole("heading", { name: "My favorite topics" })).toHaveCount(0);
});

test("tour step 1 lets you tap the phrase for real, then continues at step 2", async ({ page }) => {
  await onboard(page);
  await expect(page.getByText("Tap an underlined phrase to read about it.")).toBeVisible();
  await page.getByRole("button", { name: "Try it: open the preview" }).click();
  const peek = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Read", exact: true }) });
  await expect(peek).toBeVisible();
  await expect(page.getByText("Tap an underlined phrase to read about it.")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Highlight any text to ask Birdie about it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip tour" })).toBeVisible();
});

test("feed article has dotted openings, a peek, and Next, maybe nudges", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const article = page.locator("[data-article]").first();
  const openings = article.locator("a.opening");
  expect(await openings.count()).toBeGreaterThanOrEqual(3);

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

test("a topic opened from Next, maybe keeps going as a feed", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const card = page.getByRole("region", { name: "Next, maybe" }).first().getByRole("button").first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const pageScroller = page.locator("[data-page-scroller]").last();
  // A tall desktop window can already show the next article; a phone shows just this one.
  await expect(pageScroller.locator("[data-article]").first()).toBeVisible();
  const before = await pageScroller.locator("[data-article]").count();
  for (let i = 0; i < 4; i++) await pageScroller.evaluate((e) => e.scrollBy(0, 2500));
  await expect.poll(() => pageScroller.locator("[data-article]").count()).toBeGreaterThan(before);
});

test("Back says where it goes, and a long press jumps to the feed", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const card = page.getByRole("region", { name: "Next, maybe" }).first().getByRole("button").first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(page.getByRole("button", { name: "Back to Feed" })).toBeVisible();
  const deeper = page.locator("[data-page-scroller]").last().getByRole("region", { name: "Next, maybe" }).first().getByRole("button").first();
  await deeper.scrollIntoViewIfNeeded();
  await deeper.click();
  const back = page.getByRole("button", { name: /^Back to (?!Feed)/ }).last();
  await expect(back).toBeVisible();
  await back.hover();
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await expect(page.getByRole("button", { name: /^Back to/ })).toHaveCount(0);
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

test("thumbs at the end of an article record a vote, toggle off, and persist", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const up = page.getByRole("button", { name: "More like this" }).first();
  const down = page.getByRole("button", { name: "Fewer like this" }).first();
  await up.click();
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await down.click();
  await expect(down).toHaveAttribute("aria-pressed", "true");
  await expect(up).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Got it. Fewer like this.")).toBeVisible();
  // Saves are debounced; wait for the vote to land in storage.
  await expect
    .poll(() => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("birdie.state.v1") || "{}").profile?.votes ?? {})))
    .toEqual([-1]);
  await down.click();
  await expect(down).toHaveAttribute("aria-pressed", "false");
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

test("a corrupt saved state recovers instead of crashing", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        "birdie.state.v1",
        JSON.stringify({ onboarded: true, profile: { picked: ["Music", "Math", "Food"] }, saved: null, prefs: { theme: "nope", size: 99 } }),
      );
    }
  });
  await page.goto("/");
  await expect(page.locator("[data-article] h1").first()).toBeVisible();
  await expect(page.getByText("Birdie tripped over something.")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-reader-theme", "dark");
});

test("Ask under an article opens chat without selecting text", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const article = page.locator("[data-article]").first();
  await article.getByRole("button", { name: "Ask", exact: true }).scrollIntoViewIfNeeded();
  await article.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sum it up" })).toBeVisible();
  await page.getByRole("button", { name: "Sum it up" }).click();
  await expect(page.getByText("READ NEXT")).toBeVisible({ timeout: 15_000 });
});

test("keyboard: sheets take focus, keep it, and give it back", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Skip tour" }).click();
  const trigger = page.getByRole("button", { name: "Reading settings" }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const inDialog = () => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"));
  await expect.poll(inDialog).toBe(true);
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  expect(await inDialog()).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
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
