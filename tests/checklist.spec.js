const { test, expect } = require("@playwright/test");

// Each test gets a new browser context, so localStorage starts empty.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Checklist" })).toBeVisible();
});

// Top-level item rows only; sub-items are nested inside them.
function getItemRows(page) {
  return page.locator("#checklist > li");
}

function getSubItemRows(page, parentItemText) {
  return getItemRows(page).filter({ hasText: parentItemText }).locator(".sub-items > li:not(.sub-item-input-row)");
}

async function addItem(page, itemText) {
  await page.getByPlaceholder("Add an item...").fill(itemText);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(getItemRows(page).filter({ hasText: itemText })).toBeVisible();
}

test.describe("items", () => {
  test("adds, completes, and deletes items", async ({ page }) => {
    await addItem(page, "Buy milk");
    await expect(page.locator("#progress-summary")).toHaveText("0 of 1 completed");

    await page.getByRole("checkbox", { name: "Buy milk" }).check();
    await expect(page.locator("#checklist .item-row.completed")).toHaveText(/Buy milk/);
    await expect(page.locator("#progress-summary")).toHaveText("1 of 1 completed");

    await page.getByRole("button", { name: "Delete Buy milk" }).click();
    await expect(getItemRows(page)).toHaveCount(0);
    await expect(page.locator("#progress-summary")).toHaveText("No items yet.");
  });

  test("items persist after reload", async ({ page }) => {
    await addItem(page, "Persisted item");
    await page.reload();
    await expect(getItemRows(page)).toHaveText([/Persisted item/]);
  });
});

test.describe("Ctrl+D shortcut", () => {
  for (const modifierKey of ["Control", "Meta"]) {
    test(`${modifierKey}+D deletes the last added item`, async ({ page }) => {
      await addItem(page, "First");
      await addItem(page, "Second");
      await addItem(page, "Third");

      await page.keyboard.press(`${modifierKey}+D`);
      await expect(getItemRows(page)).toHaveText([/First/, /Second/]);

      await page.reload();
      await expect(getItemRows(page)).toHaveText([/First/, /Second/]);
    });
  }

  test("works while the text box is focused and leaves its text alone", async ({ page }) => {
    await addItem(page, "First");
    await addItem(page, "Second");

    const newItemTextInput = page.getByPlaceholder("Add an item...");
    await newItemTextInput.fill("draft text");
    await newItemTextInput.press("Control+D");

    await expect(getItemRows(page)).toHaveText([/First/]);
    await expect(newItemTextInput).toHaveValue("draft text");
    await expect(newItemTextInput).toBeFocused();
  });

  test("does nothing on an empty list", async ({ page }) => {
    await page.keyboard.press("Control+D");
    await expect(page.locator("#progress-summary")).toHaveText("No items yet.");
  });

  test("cancels the browser's default bookmark action", async ({ page }) => {
    await page.evaluate(() => {
      window.addEventListener("keydown", (keyboardEvent) => {
        window.lastKeydownWasDefaultPrevented = keyboardEvent.defaultPrevented;
      });
    });
    await page.keyboard.press("Control+D");
    expect(await page.evaluate(() => window.lastKeydownWasDefaultPrevented)).toBe(true);
  });

  test("only affects the current list", async ({ page }) => {
    await addItem(page, "Stays");
    await page.getByRole("button", { name: "+ New list" }).click();
    await expect(page.getByRole("textbox", { name: "List name" })).toBeFocused();
    await page.keyboard.press("Enter");
    await addItem(page, "Goes away");

    await page.keyboard.press("Control+D");
    await expect(getItemRows(page)).toHaveCount(0);

    await page.getByRole("tab", { name: "Checklist" }).click();
    await expect(getItemRows(page)).toHaveText([/Stays/]);
  });
});

test.describe("tabs", () => {
  test("each list keeps its own items, and names and items persist", async ({ page }) => {
    await addItem(page, "Default item");

    await page.getByRole("button", { name: "+ New list" }).click();
    const renameInput = page.getByRole("textbox", { name: "List name" });
    await expect(renameInput).toBeFocused();
    await renameInput.fill("Groceries");
    await renameInput.press("Enter");

    const groceriesTab = page.getByRole("tab", { name: "Groceries" });
    await expect(groceriesTab).toHaveAttribute("aria-selected", "true");
    await expect(getItemRows(page)).toHaveCount(0);
    await addItem(page, "Eggs");

    await page.getByRole("tab", { name: "Checklist" }).click();
    await expect(getItemRows(page)).toHaveText([/Default item/]);

    await page.reload();
    await expect(page.getByRole("tab")).toHaveText(["Checklist", "Groceries"]);
    await expect(page.getByRole("tab", { name: "Checklist" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Groceries" }).click();
    await expect(getItemRows(page)).toHaveText([/Eggs/]);
  });

  test("renames with the Rename button, double-click, and Escape cancels", async ({ page }) => {
    await page.getByRole("button", { name: "Rename list" }).click();
    await page.getByRole("textbox", { name: "List name" }).fill("Work");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveText(["Work"]);
    await expect(page.getByRole("tab", { name: "Work" })).toBeFocused();

    await page.getByRole("tab", { name: "Work" }).dblclick();
    await page.getByRole("textbox", { name: "List name" }).fill("Discarded name");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tab")).toHaveText(["Work"]);

    await page.getByRole("tab", { name: "Work" }).dblclick();
    await page.getByRole("textbox", { name: "List name" }).fill("Saved on blur");
    await page.getByPlaceholder("Add an item...").click();
    await expect(page.getByRole("tab")).toHaveText(["Saved on blur"]);

    await page.reload();
    await expect(page.getByRole("tab")).toHaveText(["Saved on blur"]);
  });

  test("an empty name keeps the old name", async ({ page }) => {
    await page.getByRole("button", { name: "Rename list" }).click();
    await page.getByRole("textbox", { name: "List name" }).fill("   ");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveText(["Checklist"]);
  });

  test("deletes a list after confirmation, but never the last one", async ({ page }) => {
    const deleteListButton = page.getByRole("button", { name: "Delete list" });
    await expect(deleteListButton).toBeDisabled();

    await page.getByRole("button", { name: "+ New list" }).click();
    await expect(page.getByRole("textbox", { name: "List name" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveText(["Checklist", "List 2"]);
    await expect(deleteListButton).toBeEnabled();

    page.once("dialog", (dialog) => dialog.dismiss());
    await deleteListButton.click();
    await expect(page.getByRole("tab")).toHaveText(["Checklist", "List 2"]);

    page.once("dialog", (dialog) => dialog.accept());
    await deleteListButton.click();
    await expect(page.getByRole("tab")).toHaveText(["Checklist"]);
    await expect(deleteListButton).toBeDisabled();

    await page.reload();
    await expect(page.getByRole("tab")).toHaveText(["Checklist"]);
  });
});

test.describe("keyboard only", () => {
  test("text box is focused on load and Escape moves focus to the list", async ({ page }) => {
    const newItemTextInput = page.getByPlaceholder("Add an item...");
    await expect(newItemTextInput).toBeFocused();

    await page.keyboard.type("First");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second");
    await page.keyboard.press("Enter");
    await expect(getItemRows(page)).toHaveText([/First/, /Second/]);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("checkbox", { name: "First" })).toBeFocused();

    await page.keyboard.press("n");
    await expect(newItemTextInput).toBeFocused();
    await expect(newItemTextInput).toHaveValue("");
  });

  test("arrow keys move between items, Space and Enter toggle, Delete removes", async ({ page }) => {
    await addItem(page, "One");
    await addItem(page, "Two");
    await addItem(page, "Three");
    await page.getByPlaceholder("Add an item...").press("Escape");

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("checkbox", { name: "Two" })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("checkbox", { name: "Two" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Two" })).toBeFocused();

    await page.keyboard.press("End");
    await expect(page.getByRole("checkbox", { name: "Three" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("checkbox", { name: "Three" })).toBeChecked();

    await page.keyboard.press("Home");
    await expect(page.getByRole("checkbox", { name: "One" })).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(getItemRows(page)).toHaveText([/Two/, /Three/]);
    await expect(page.getByRole("checkbox", { name: "Two" })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Backspace");
    await expect(getItemRows(page)).toHaveText([/Two/]);
    await expect(page.getByRole("checkbox", { name: "Two" })).toBeFocused();

    await page.keyboard.press("Delete");
    await expect(getItemRows(page)).toHaveCount(0);
    await expect(page.getByPlaceholder("Add an item...")).toBeFocused();
  });

  test("T creates a list, R renames, [ and ] and arrow keys switch lists", async ({ page }) => {
    await page.keyboard.press("Escape");

    await page.keyboard.press("t");
    await expect(page.getByRole("textbox", { name: "List name" })).toBeFocused();
    await page.keyboard.type("Groceries");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab", { name: "Groceries" })).toBeFocused();

    await page.keyboard.press("t");
    await expect(page.getByRole("textbox", { name: "List name" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveText(["Checklist", "Groceries", "List 3"]);

    await page.keyboard.press("r");
    await page.keyboard.type("Work");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveText(["Checklist", "Groceries", "Work"]);

    await page.keyboard.press("[");
    await expect(page.getByRole("tab", { name: "Groceries" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Checklist" })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Work" })).toBeFocused();
    await page.keyboard.press("]");
    await expect(page.getByRole("tab", { name: "Checklist" })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Work" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: "Checklist" })).toBeFocused();

    await page.keyboard.press("F2");
    await page.keyboard.type("Renamed with F2");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveText(["Renamed with F2", "Groceries", "Work"]);
  });

  test("single-key shortcuts are typed normally inside text boxes", async ({ page }) => {
    const newItemTextInput = page.getByPlaceholder("Add an item...");
    await page.keyboard.type("tnr[]?/");
    await expect(newItemTextInput).toHaveValue("tnr[]?/");
    await expect(page.getByRole("tab")).toHaveCount(1);
    await expect(page.locator("#keyboard-help")).not.toHaveAttribute("open", "");
  });

  test("? toggles the shortcut help", async ({ page }) => {
    await page.keyboard.press("Escape");
    await page.keyboard.press("?");
    await expect(page.locator("#keyboard-help")).toHaveAttribute("open", "");
    await page.keyboard.press("?");
    await expect(page.locator("#keyboard-help")).not.toHaveAttribute("open", "");
  });

  test("Tab key reaches every control", async ({ page }) => {
    await addItem(page, "Reachable");
    await page.getByRole("tab", { name: "Checklist" }).focus();

    const expectedFocusOrder = [
      page.getByRole("button", { name: "+ New list" }),
      page.getByRole("button", { name: "Rename list" }),
      page.getByPlaceholder("Add an item..."),
      page.getByRole("button", { name: "Add", exact: true }),
      page.getByRole("checkbox", { name: "Reachable" }),
      page.getByRole("button", { name: "Add sub-item to Reachable" }),
      page.getByRole("button", { name: "Delete Reachable" }),
      page.getByText("Keyboard shortcuts"),
    ];
    for (const expectedFocusedElement of expectedFocusOrder) {
      await page.keyboard.press("Tab");
      await expect(expectedFocusedElement).toBeFocused();
    }
  });
});

test("unreadable saved data falls back to an empty list", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("checklists", "{not valid json"));
  await page.reload();
  await expect(page.getByRole("tab")).toHaveText(["Checklist"]);
  await expect(page.locator("#progress-summary")).toHaveText("No items yet.");
});

test.describe("sub-items", () => {
  test("adds, completes, and deletes sub-items with the mouse, and they persist", async ({ page }) => {
    await addItem(page, "Pack");
    await page.getByRole("button", { name: "Add sub-item to Pack" }).click();
    const subItemInput = page.getByRole("textbox", { name: "New sub-item for Pack" });
    await expect(subItemInput).toBeFocused();
    await subItemInput.fill("Socks");
    await subItemInput.press("Enter");
    await expect(subItemInput).toBeFocused();
    await subItemInput.fill("Charger");
    await subItemInput.press("Enter");
    await expect(getSubItemRows(page, "Pack")).toHaveText([/Socks/, /Charger/]);
    await expect(page.locator(".sub-item-progress")).toHaveText("0/2");

    await page.getByRole("checkbox", { name: "Socks" }).check();
    await expect(page.locator(".sub-item-progress")).toHaveText("1/2");
    await expect(page.getByRole("checkbox", { name: "Pack" })).not.toBeChecked();
    await expect(page.locator("#progress-summary")).toHaveText("0 of 1 completed");

    await page.reload();
    await expect(getSubItemRows(page, "Pack")).toHaveText([/Socks/, /Charger/]);
    await expect(page.getByRole("checkbox", { name: "Socks" })).toBeChecked();

    await page.getByRole("button", { name: "Delete Socks" }).click();
    await expect(getSubItemRows(page, "Pack")).toHaveText([/Charger/]);
    await expect(getItemRows(page)).toHaveCount(1);
  });

  test("clicking elsewhere closes the sub-item box and the click still works", async ({ page }) => {
    await addItem(page, "First");
    await addItem(page, "Second");
    await page.getByRole("button", { name: "Add sub-item to First" }).click();
    await expect(page.getByRole("textbox", { name: "New sub-item for First" })).toBeFocused();

    await page.getByRole("checkbox", { name: "Second" }).click();
    await expect(page.getByRole("textbox", { name: "New sub-item for First" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Second" })).toBeChecked();
  });

  test("keyboard: S opens the box, Esc closes it, arrows move through sub-items", async ({ page }) => {
    await addItem(page, "Parent");
    await addItem(page, "After");
    await page.getByPlaceholder("Add an item...").press("Escape");
    await expect(page.getByRole("checkbox", { name: "Parent" })).toBeFocused();

    await page.keyboard.press("s");
    const subItemInput = page.getByRole("textbox", { name: "New sub-item for Parent" });
    await expect(subItemInput).toBeFocused();
    await page.keyboard.type("Child one");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Child two");
    await page.keyboard.press("Enter");
    // Backspace and single-letter shortcuts must not act on the parent row while typing.
    await page.keyboard.type("sx");
    await page.keyboard.press("Backspace");
    await expect(subItemInput).toHaveValue("s");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("checkbox", { name: "Parent" })).toBeFocused();
    await expect(subItemInput).toHaveCount(0);
    await expect(getSubItemRows(page, "Parent")).toHaveText([/Child one/, /Child two/]);

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("checkbox", { name: "Child one" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("checkbox", { name: "Child two" })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("checkbox", { name: "Child two" })).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("checkbox", { name: "After" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("checkbox", { name: "Child two" })).toBeFocused();

    // S on a sub-item does nothing because sub-items cannot have their own sub-items.
    await page.keyboard.press("s");
    await expect(page.getByRole("textbox", { name: /New sub-item/ })).toHaveCount(0);

    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Delete");
    await expect(getSubItemRows(page, "Parent")).toHaveText([/Child two/]);
    await expect(page.getByRole("checkbox", { name: "Child two" })).toBeFocused();
    await expect(getItemRows(page)).toHaveCount(2);
  });

  test("Enter on an empty sub-item box closes it", async ({ page }) => {
    await addItem(page, "Parent");
    await page.getByRole("button", { name: "Add sub-item to Parent" }).click();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "New sub-item for Parent" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Parent" })).toBeFocused();
  });

  test("deleting a parent removes its sub-items, and Ctrl+D removes the last top-level item", async ({ page }) => {
    await addItem(page, "Keep");
    await addItem(page, "Remove");
    await page.getByRole("button", { name: "Add sub-item to Remove" }).click();
    await page.keyboard.type("Nested");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+D");
    await expect(getItemRows(page)).toHaveText([/Keep/]);
    await expect(page.getByRole("checkbox", { name: "Nested" })).toHaveCount(0);
  });

  test("items saved without sub-items still load", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("checklists", JSON.stringify([
        { id: "list-1", name: "Saved", items: [{ id: "item-1", text: "Old item", completed: false }] },
      ]));
    });
    await page.reload();
    await page.getByRole("button", { name: "Add sub-item to Old item" }).click();
    await page.keyboard.type("New child");
    await page.keyboard.press("Enter");
    await expect(getSubItemRows(page, "Old item")).toHaveText([/New child/]);
  });
});
