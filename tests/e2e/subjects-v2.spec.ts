import { mkdir } from "node:fs/promises";
import { expect, readFixture, test, waitForLearnerRoute } from "./fixtures/app";

async function finishMotion(page: import("@playwright/test").Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))));
}

async function revealPageForEvidence(page: import("@playwright/test").Page) {
  const main = page.getByRole("main", { name: "Application content" });
  await main.evaluate(async (element) => {
    const scroller = element as HTMLElement;
    for (let top = 0; top < scroller.scrollHeight; top += 500) {
      scroller.scrollTo({ top, behavior: "instant" });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    scroller.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(700);
  await finishMotion(page);
}

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test("@phase3 all five Subjects routes and all four subject tabs render at mobile and desktop widths", async ({ learnerPage }) => {
  test.setTimeout(120_000);
  const fixture = await readFixture();
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  const routes = [
    ["my-subjects", "/subjects"],
    ["subject-folder", `/subjects/folders/${fixture.subjectFolderId}`],
    ["subject-detail", `/subjects/${fixture.subjectId}`],
    ["topic-folder", `/subjects/${fixture.subjectId}/folders/${fixture.folderId}`],
    ["topic-detail", `/subjects/${fixture.subjectId}/topics/${fixture.topicId}`],
  ] as const;

  for (const [name, route] of routes) {
    for (const [size, width, height] of [["desktop", 1440, 1100], ["mobile", 390, 844]] as const) {
      await learnerPage.setViewportSize({ width, height });
      await waitForLearnerRoute(learnerPage, route);
      if (name === "my-subjects") await expect(learnerPage.getByRole("heading", { name: "Unfiled Subjects" })).toBeVisible();
      if (name === "subject-folder") await expect(learnerPage.getByRole("heading", { name: "Biology", exact: true })).toBeVisible();
      if (name === "subject-detail") await expect(learnerPage.getByRole("button", { name: /Cellular Biology.*1 topics/ })).toBeVisible();
      if (name === "topic-folder") await expect(learnerPage.getByRole("heading", { name: "Long Synthetic Topic Name for Hero Wrapping Checks" })).toBeVisible();
      if (name === "topic-detail") await expect(learnerPage.getByRole("heading", { name: "Flashcard Studio" })).toBeVisible();
      await finishMotion(learnerPage);
      await assertNoHorizontalOverflow(learnerPage, width);
      const stats = learnerPage.getByTestId("study-statistics");
      await expect(stats).toBeVisible();
      if (name === "my-subjects") await expect(stats.locator("article")).toHaveCount(4);
      if (name === "subject-folder") await expect(stats.locator("article")).toHaveCount(3);
      if (name === "subject-detail") await expect(stats.locator("article")).toHaveCount(4);
      if (name === "topic-folder") await expect(stats.locator("article")).toHaveCount(2);
      if (name === "topic-detail") await expect(stats.locator("article")).toHaveCount(4);
      if (name === "subject-detail") {
        await expect(learnerPage.getByRole("link", { name: /Study Subject/ })).toHaveCount(0);
        for (const tabName of ["Topics", "All Flashcards", "Progress", "Settings"]) {
          const tab = learnerPage.getByRole("tab", { name: tabName });
          await tab.click();
          await expect(tab).toHaveAttribute("aria-selected", "true");
          if (size === "desktop") await finishMotion(learnerPage);
          if (tabName === "All Flashcards") await expect(learnerPage.getByRole("heading", { name: "All Flashcards" })).toBeVisible();
          if (tabName === "Progress") await expect(learnerPage.getByRole("heading", { name: "Study Progress" })).toBeVisible();
          if (tabName === "Settings") await expect(learnerPage.getByRole("heading", { name: "Danger Zone" })).toBeVisible();
          if (tabName === "Topics" && size === "desktop") { await revealPageForEvidence(learnerPage); await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase03-final-subject-detail-desktop.png", fullPage: true }); }
          if (tabName === "Progress" && size === "desktop") { await revealPageForEvidence(learnerPage); await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase03-final-subject-progress-desktop.png", fullPage: true }); }
        }
        await learnerPage.getByRole("tab", { name: "Topics" }).click();
      }
      if (name === "topic-detail") await expect(learnerPage.getByRole("link", { name: "Study Topic" })).toHaveAttribute("href", `/review/setup?subjectId=${fixture.subjectId}&topicId=${fixture.topicId}`);
      if (!(name === "subject-detail" && size === "desktop")) {
        await revealPageForEvidence(learnerPage);
        await learnerPage.screenshot({ path: `docs/ABII_V2/evidence/phase03-final-${name}-${size}.png`, fullPage: true });
        if (name === "my-subjects") {
          await learnerPage.getByRole("main", { name: "Application content" }).evaluate(element => (element as HTMLElement).scrollTo({ top: (element as HTMLElement).scrollHeight, behavior: "instant" }));
          await learnerPage.waitForTimeout(500);
          await finishMotion(learnerPage);
          await learnerPage.screenshot({ path: `docs/ABII_V2/evidence/phase03-final-my-subjects-${width}.png`, fullPage: true });
        }
      }
    }
  }
});

test("@phase3 complete library and subject statistics use the correct owner and subject scope", async ({ learnerPage }) => {
  const fixture = await readFixture();
  await learnerPage.setViewportSize({ width: 1440, height: 1000 });
  await waitForLearnerRoute(learnerPage, "/subjects");
  const libraryStats = learnerPage.getByLabel("Study library totals");
  await expect(libraryStats).toContainText("2");
  await expect(libraryStats).toContainText("3");
  const unfiledSection = learnerPage.getByTestId("unfiled-subjects");
  await expect(learnerPage.getByRole("heading", { name: "Collections" })).toBeVisible();
  await expect(learnerPage.getByRole("heading", { name: "Unfiled Subjects" })).toBeVisible();
  await expect(learnerPage.getByText("Move subjects into folders to keep your study space organized.")).toBeVisible();
  await expect(unfiledSection.getByRole("link", { name: "Unfiled Chemistry", exact: true })).toBeVisible();
  await expect(learnerPage.getByRole("link", { name: "Unfiled Subjects" })).toHaveCount(0);
  await expect(learnerPage.getByRole("link", { name: /Biology/ })).toBeVisible();

  await unfiledSection.getByRole("button", { name: "Move Subject" }).click();
  let moveDialog = learnerPage.getByRole("dialog", { name: "Move Subject" });
  await moveDialog.getByLabel("Destination Folder").selectOption(fixture.subjectFolderId);
  await moveDialog.getByRole("button", { name: "Move Subject" }).click();
  await expect(unfiledSection.getByRole("link", { name: "Unfiled Chemistry", exact: true })).toHaveCount(0);
  await expect(learnerPage.getByRole("link", { name: /Biology/ })).toBeVisible();

  await waitForLearnerRoute(learnerPage, `/subjects/folders/${fixture.subjectFolderId}`);
  await expect(learnerPage.getByRole("link", { name: "Unfiled Chemistry", exact: true })).toBeVisible();
  await learnerPage.getByRole("article").filter({ hasText: "Unfiled Chemistry" }).getByRole("button", { name: "Move Subject" }).click();
  moveDialog = learnerPage.getByRole("dialog", { name: "Move Subject" });
  await moveDialog.getByLabel("Destination Folder").selectOption("");
  await moveDialog.getByRole("button", { name: "Move Subject" }).click();
  await expect(learnerPage.getByRole("link", { name: "Unfiled Chemistry", exact: true })).toHaveCount(0);
  await waitForLearnerRoute(learnerPage, "/subjects");
  await expect(learnerPage.getByTestId("unfiled-subjects").getByRole("link", { name: "Unfiled Chemistry", exact: true })).toBeVisible();

  await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}`);
  const progressTab = learnerPage.getByRole("tab", { name: "Progress" });
  await expect(progressTab).toBeVisible();
  await learnerPage.waitForTimeout(250);
  await progressTab.click();
  await expect(progressTab).toHaveAttribute("aria-selected", "true");
  const reviewed = learnerPage.getByTestId("subject-reviewed-count");
  await expect(reviewed).toContainText("0");
  await expect(learnerPage.getByRole("heading", { name: "Topic mastery" })).toBeVisible();

  await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}/topics/${fixture.topicId}`);
  const topicStats = learnerPage.getByTestId("study-statistics");
  await expect(topicStats).toContainText("2");
  await expect(topicStats).toContainText("Enumeration");
  await expect(topicStats.getByRole("progressbar")).toHaveCount(1);
  await expect(topicStats.getByLabel("Question type completion").getByLabel(/Multiple Choice|Identification|True or False|Mixed \/ Random/)).toHaveCount(4);
  await expect(learnerPage.getByRole("region", { name: /mastery summary/ })).toHaveCount(0);
  await expect(learnerPage.getByText("Ready to review?")).toHaveCount(0);
  await expect(learnerPage.getByTestId("topic-flashcard-toolbar").getByRole("link", { name: /Study Topic/ })).toHaveAttribute("data-button-variant", "outline");
  await expect(learnerPage.getByTestId("topic-flashcard-toolbar").getByRole("button", { name: /Add Flashcard/ })).toHaveAttribute("data-button-variant", "primary");
  await expect(learnerPage.getByRole("group", { name: "Topic mastery details" })).toBeVisible();
});

test("@phase3 all subject topics remain discoverable through folder expansion, search, sorting and tab changes", async ({ learnerPage }) => {
  const fixture = await readFixture();
  await learnerPage.setViewportSize({ width: 1440, height: 950 });
  await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}`);
  const folder = learnerPage.getByRole("button", { name: /Cellular Biology.*1 topics/ });
  const assigned = learnerPage.getByRole("heading", { name: "Long Synthetic Topic Name for Hero Wrapping Checks" });
  const unfiled = learnerPage.getByRole("heading", { name: "Unfiled Cell Biology" });

  await expect(learnerPage.getByText("Folders & Topics 2")).toBeVisible();
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  await expect(assigned).toBeVisible();
  await expect(unfiled).toBeVisible();
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "false");
  await expect(assigned).toBeHidden();
  await expect(unfiled).toBeVisible();
  await folder.click();
  await expect(assigned).toBeVisible();

  const search = learnerPage.getByPlaceholder("Find a topic...");
  await search.fill("Long Synthetic Topic");
  await expect(assigned).toBeVisible();
  await search.fill("Unfiled Cell");
  await expect(unfiled).toBeVisible();
  await expect(assigned).toBeHidden();
  await search.clear();
  await learnerPage.getByLabel("Topic Order").selectOption("position");
  await expect(assigned).toBeVisible();
  await learnerPage.getByRole("tab", { name: "All Flashcards" }).click();
  await expect(learnerPage.getByRole("tab", { name: "All Flashcards" })).toHaveAttribute("aria-selected", "true");
  await learnerPage.getByRole("tab", { name: "Topics" }).click();
  await expect(learnerPage.getByRole("tab", { name: "Topics" })).toHaveAttribute("aria-selected", "true");
  await expect(assigned).toBeVisible();
  await expect(unfiled).toBeVisible();

  await learnerPage.getByRole("main", { name: "Application content" }).evaluate(async (element) => {
    const main = element as HTMLElement;
    main.scrollTo({ top: main.scrollHeight, behavior: "instant" });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    main.scrollTo({ top: 0, behavior: "instant" });
  });
  await finishMotion(learnerPage);
  await expect(assigned).toBeVisible();
  await expect(unfiled).toBeVisible();
  await learnerPage.getByRole("main", { name: "Application content" }).evaluate(element => (element as HTMLElement).scrollTo({ top: (element as HTMLElement).scrollHeight, behavior: "instant" }));
  await learnerPage.waitForTimeout(500);
  await finishMotion(learnerPage);
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase03-final-subject-topics-bottom.png", fullPage: true });

  await waitForLearnerRoute(learnerPage, `/subjects/${fixture.secondSubjectId}`);
  await expect(learnerPage.getByRole("heading", { name: "Empty Practice Topic" })).toBeVisible();
  await expect(learnerPage.getByText("0 flashcards", { exact: true })).toBeVisible();
});

test("@phase3 empty learner library stays honest and keeps create actions visible", async ({ learnerPage }) => {
  const fixture = await readFixture();
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.context().clearCookies();
  await learnerPage.context().addCookies([{ name: "abii_session", value: fixture.emptyToken, url: fixture.baseURL, httpOnly: true, sameSite: "Strict" }]);
  await learnerPage.setViewportSize({ width: 1440, height: 1000 });
  await waitForLearnerRoute(learnerPage, "/subjects");
  await expect(learnerPage.getByText("Create your first subject to organize your topics and flashcards.")).toBeVisible();
  await expect(learnerPage.getByRole("button", { name: "Create Your First Subject" })).toBeVisible();
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase03-my-subjects-empty.png", fullPage: true });
});

test("@phase3 flashcard editor, view and protected deletion use the shared modal and preserve type details", async ({ learnerPage }) => {
  test.setTimeout(120_000);
  const fixture = await readFixture();
  await mkdir("docs/ABII_V2/evidence", { recursive: true });
  await learnerPage.setViewportSize({ width: 1440, height: 1000 });
  await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}/topics/${fixture.topicId}`);
  await learnerPage.waitForTimeout(250);
  await learnerPage.getByRole("button", { name: "Add Flashcard" }).click();
  const editor = learnerPage.getByRole("dialog", { name: "Create a Flashcard" });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("button", { name: "Create Flashcard" })).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(editor.getByRole("group", { name: "Flashcard topic context" })).toContainText("This flashcard belongs to the current topic.");
  await expect(editor.getByLabel("Topic (Required)")).toHaveCount(0);
  await finishMotion(learnerPage);
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase03-standard-editor-desktop.png" });
  await editor.getByText("Enumeration", { exact: true }).click();
  await learnerPage.setViewportSize({ width: 390, height: 844 });
  await finishMotion(learnerPage);
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase03-refined-enumeration-editor-390.png" });
  await learnerPage.setViewportSize({ width: 1440, height: 1000 });
  await editor.getByText("Standard", { exact: true }).click();
  await editor.getByLabel("Question (Required)").fill("Synthetic loading label question");
  await editor.getByLabel("Answer (Required)").fill("Synthetic loading label answer");
  await learnerPage.route(`**/api/subjects/${fixture.subjectId}/flashcards`, async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ card: { id: "synthetic-created-card", topicId: fixture.topicId, topicName: "Long Synthetic Topic Name for Hero Wrapping Checks", flashcardType: "standard", question: "Synthetic loading label question", answer: "Synthetic loading label answer", hint: "", reviewed: false } }) });
  });
  await editor.getByRole("button", { name: "Create Flashcard" }).click();
  await expect(editor.getByRole("button", { name: "Creating Flashcard…" })).toBeVisible();
  await expect(editor).toBeHidden();
  await learnerPage.unroute(`**/api/subjects/${fixture.subjectId}/flashcards`);
  await learnerPage.keyboard.press("Escape");
  await expect(editor).toBeHidden();

  await learnerPage.getByRole("button", { name: "Edit What is the basic unit of life?" }).click();
  const topicEdit = learnerPage.getByRole("dialog", { name: "Edit Flashcard" });
  await expect(topicEdit.getByRole("group", { name: "Flashcard topic context" })).toContainText("Long Synthetic Topic Name for Hero Wrapping Checks");
  await expect(topicEdit.getByLabel("Topic (Required)")).toHaveCount(0);
  await learnerPage.keyboard.press("Escape");

  await learnerPage.getByRole("button", { name: "View What is the basic unit of life?" }).click();
  const view = learnerPage.getByRole("dialog", { name: "Flashcard Details" });
  await expect(view.getByText("The cell.")).toBeVisible();
  await expect(view.getByText("Standard", { exact: true })).toBeVisible();
  await learnerPage.keyboard.press("Escape");

  await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}`);
  await learnerPage.getByRole("tab", { name: "All Flashcards" }).click();
  await learnerPage.getByRole("button", { name: "Add Flashcard" }).click();
  const subjectEditor = learnerPage.getByRole("dialog", { name: "Create a Flashcard" });
  const topicSelector = subjectEditor.getByLabel("Topic (Required)");
  await expect(topicSelector).toBeVisible();
  await expect(topicSelector.locator("option")).toHaveCount(3);
  await topicSelector.selectOption(fixture.unfiledTopicId);
  await expect(topicSelector).toHaveValue(fixture.unfiledTopicId);
  await learnerPage.keyboard.press("Escape");
  await learnerPage.getByRole("button", { name: "Edit What is the basic unit of life?" }).click();
  const subjectEdit = learnerPage.getByRole("dialog", { name: "Edit Flashcard" });
  const editableTopicSelector = subjectEdit.getByLabel("Topic (Required)");
  await expect(editableTopicSelector).toHaveValue(fixture.topicId);
  await editableTopicSelector.selectOption(fixture.unfiledTopicId);
  await expect(editableTopicSelector).toHaveValue(fixture.unfiledTopicId);
  await learnerPage.keyboard.press("Escape");

  const settingsTab = learnerPage.getByRole("tab", { name: "Settings" });
  await settingsTab.click();
  await expect(settingsTab).toHaveAttribute("aria-selected", "true");
  await expect(learnerPage.getByRole("heading", { name: "Danger Zone" })).toBeVisible();
  await learnerPage.getByRole("button", { name: "Delete Subject" }).click();
  const deletion = learnerPage.getByRole("alertdialog", { name: "Delete This Subject?" });
  await expect(deletion).toBeVisible();
  await finishMotion(learnerPage);
  await learnerPage.screenshot({ path: "docs/ABII_V2/evidence/phase03-delete-subject-modal.png" });
  await expect(deletion.getByRole("button", { name: "Delete Subject" })).toHaveCSS("background-color", "rgb(248, 118, 156)");
  await learnerPage.keyboard.press("Escape");
  await expect(deletion).toBeHidden();
});

test("@phase3 representative subject and topic toolbars remain usable at narrow and tablet widths", async ({ learnerPage }) => {
  const fixture = await readFixture();
  for (const width of [320, 768]) {
    await learnerPage.setViewportSize({ width, height: 900 });
    await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}`);
    await learnerPage.getByRole("tab", { name: "Topics" }).click();
    await expect(learnerPage.getByPlaceholder("Find a topic...")).toBeVisible();
    await assertNoHorizontalOverflow(learnerPage, width);
    await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}/folders/${fixture.folderId}`);
    await expect(learnerPage.getByLabel("Topic Order")).toBeVisible();
    await expect(learnerPage.getByRole("button", { name: "New Topic" })).toBeVisible();
    await assertNoHorizontalOverflow(learnerPage, width);
    await waitForLearnerRoute(learnerPage, `/subjects/${fixture.subjectId}/topics/${fixture.topicId}`);
    await expect(learnerPage.getByRole("group", { name: "Filter flashcards by type" })).toBeVisible();
    await assertNoHorizontalOverflow(learnerPage, width);
  }
});
