// Regression fixtures that exercise a resumed expedition must explicitly pass
// the title screen. Startup/menu tests deliberately do not use this helper.
async function resumeSavedRun(page) {
  await page.evaluate(() => CompanyIntro.skip(true));
  if (await page.locator("#menu-continue").isVisible())
    await page.locator("#menu-continue").click();
}
module.exports = { resumeSavedRun };
