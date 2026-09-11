import { expect, test } from '@playwright/test'

test('expanded stage, controls layout and media rotation render without runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.locator('.duo-device')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
  await expect(page.locator('.duo-status')).toHaveCount(0)

  const stage = page.locator('.phone-stage')
  const controls = page.locator('.phone-controls-area')
  await expect(stage).toBeVisible()
  await expect(controls).toBeVisible()

  const stageBox = await stage.boundingBox()
  const controlsBox = await controls.boundingBox()
  if (!stageBox || !controlsBox) throw new Error('Missing stage layout boxes')
  expect(controlsBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1)

  await page.getByRole('button', { name: '调节', exact: true }).click()
  const largeScreenSection = page.locator('.control-section').filter({ hasText: '大屏内容' })
  const ranges = largeScreenSection.locator('input[type="range"]')
  await expect(ranges).toHaveCount(5)
  await ranges.nth(3).fill('18')
  await ranges.nth(4).fill('-14')
  await page.waitForTimeout(250)

  await expect(page.locator('.duo-device')).toHaveAttribute('data-ready', 'true')
  expect(runtimeErrors).toEqual([])

  await page.getByRole('button', { name: '重置版本', exact: true }).click()
  await expect(ranges.nth(3)).toHaveValue('0')
  await expect(ranges.nth(4)).toHaveValue('0')
})
