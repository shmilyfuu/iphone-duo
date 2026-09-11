import { expect, test } from '@playwright/test'

test('square stage, Z media rotation and replay toggle render without runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.locator('.duo-device')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
  await expect(page.locator('.duo-status')).toHaveCount(0)

  const stageBox = await page.locator('.phone-stage').boundingBox()
  if (!stageBox) throw new Error('Missing phone stage')
  expect(Math.abs(stageBox.width - stageBox.height)).toBeLessThan(2)

  await page.getByRole('button', { name: '调节', exact: true }).click()
  const largeScreenSection = page.locator('.control-section').filter({ hasText: '大屏内容' })
  const largeRanges = largeScreenSection.locator('input[type="range"]')
  await expect(largeRanges).toHaveCount(6)
  await largeRanges.nth(5).fill('35')

  const replayToggle = page.getByText('模型动画开始时重播视频', { exact: true }).locator('..').locator('input[type="checkbox"]')
  await replayToggle.check()
  await page.getByRole('button', { name: '展开', exact: true }).click()
  await expect(page.locator('.duo-device')).toHaveAttribute('data-progress', '1.000', { timeout: 5_000 })

  await expect(page.locator('.duo-device')).toHaveAttribute('data-ready', 'true')
  expect(runtimeErrors).toEqual([])
})