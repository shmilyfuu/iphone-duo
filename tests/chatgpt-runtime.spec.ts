import { expect, test } from '@playwright/test'

test('freeze frame and delayed playback controls render without runtime errors', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.locator('.duo-device')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
  await expect(page.locator('.duo-status')).toHaveCount(0)

  await page.getByRole('button', { name: '调节', exact: true }).click()
  const media = page.locator('.media-editor')
  await expect(media.getByText('定格帧', { exact: true })).toHaveCount(2)
  await expect(media.getByText('播放延迟（秒）', { exact: true })).toHaveCount(2)

  const largeFreezeDelay = media.locator('.time-controls').nth(1).locator('input[type="number"]')
  await largeFreezeDelay.nth(0).fill('1.234')
  await largeFreezeDelay.nth(1).fill('0.125')
  await expect(largeFreezeDelay.nth(0)).toHaveValue('1.234')
  await expect(largeFreezeDelay.nth(1)).toHaveValue('0.125')

  const replayToggle = media.getByText('模型动画开始时重播视频', { exact: true }).locator('..').locator('input[type="checkbox"]')
  await replayToggle.check()
  await page.getByRole('button', { name: '展开', exact: true }).click()
  await expect(page.locator('.duo-device')).toHaveAttribute('data-progress', '1.000', { timeout: 5_000 })

  expect(runtimeErrors).toEqual([])
})
