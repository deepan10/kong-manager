import { expect } from '@playwright/test'
import baseTest from '@pw/base-test'
import { clearKongResources } from '@pw/commands/clearKongResources'
import { clickEntityListAction } from '@pw/commands/clickEntityListAction'
import { createKongResource } from '@pw/commands/createKongResource'
import { fillEntityForm } from '@pw/commands/fillEntityForm'
import { switchDetailTab } from '@pw/commands/switchDetailTab'
import { withNavigation } from '@pw/commands/withNavigation'
import { PluginListPage } from '@pw/pages/plugins'
import { RouteListPage } from '@pw/pages/routes'

const mockRouteName = 'testRoute'
const mockServiceName = 'testService'
const mockTag = 'testTag'

const test = baseTest().extend<{
  routeListPage: RouteListPage
  pluginListPage: PluginListPage
}>({
  routeListPage: async ({ page }, use) => use(new RouteListPage(page)),
  pluginListPage: async ({ page }, use) => use(new PluginListPage(page)),
})

test.describe('routes plugins', () => {
  test.beforeAll(async () => {
    await clearKongResources('/plugins')
    await clearKongResources('/routes')
    await clearKongResources('/services')

    const res = await createKongResource('/services', {
      name: mockServiceName,
      url: 'http://example.com:8080/test',
    })

    createKongResource('/routes', {
      name: mockRouteName,
      service: { id: res?.data.id },
      hosts: ['example.com'],
    })
  })

  test.beforeEach(async ({ page }) => {
    await new RouteListPage(page).goto()
  })

  test.afterAll(async () => {
    await clearKongResources('/plugins')
    await clearKongResources('/routes')
    await clearKongResources('/services')
  })

  test(`install a plugin for the route "${mockRouteName} from the plugins tab"`, async ({ page }) => {
    await withNavigation(page, async () => await clickEntityListAction(page, 'view'))

    const uuid = await page.locator('.uuid-container').innerText()

    await switchDetailTab(page, 'plugins')

    await withNavigation(
      page,
      async () => await page.click('.kong-ui-entities-plugins-list [data-testid="new-plugin"]')
    )

    await withNavigation(
      page,
      async () => await page.click('a.plugin-card[title="Basic Authentication"]')
    )

    await expect(page.locator('.autosuggest #route-id')).toBeVisible()
    await expect(page.locator('.autosuggest #route-id')).toHaveValue(new RegExp(`${mockRouteName}\\s*-\\s*${uuid}`))

    await withNavigation(
      page,
      async () => await page.locator('.plugin-form .primary').click()
    )
    await expect(page.locator('.k-table tbody tr')).toHaveCount(1)
    await expect(page.locator('td[data-testid="name"]')).toContainText('Basic Authentication')
  })

  test('submit/cancel the plugin form editing using header action', async ({ page }) => {
    await withNavigation(page, async () => await clickEntityListAction(page, 'view'))
    await switchDetailTab(page, 'plugins')
    await clickEntityListAction(page, 'edit')
    await withNavigation(
      page,
      async () =>
        await fillEntityForm({
          page,
          formData: {
            tags: mockTag,
          },
          withAction: 'submit',
          handleModal: true,
        }),
    )
    await expect(page.locator('.k-table [data-testid="tags"]')).toHaveText(mockTag)

    await clickEntityListAction(page, 'edit')
    await withNavigation(
      page,
      async () =>
        await fillEntityForm({
          page,
          formData: {
            tags: `${mockTag}${mockTag}`,
          },
          withAction: 'cancel',
        })
    )
    await expect(page.locator('.k-table [data-testid="tags"]')).toHaveText(mockTag)
  })

  test('change scope from global to scoped', async ({ page, pluginListPage, routeListPage }) => {
    await clearKongResources('/plugins')
    await clearKongResources('/routes')
    await clearKongResources('/services')

    const res = await createKongResource('/services', {
      name: mockServiceName,
      url: 'http://example.com:8080/test',
    })

    createKongResource('/routes', {
      name: mockRouteName,
      service: { id: res?.data.id },
      hosts: ['example.com'],
    })

    // create a global plugin
    await pluginListPage.goto()
    await withNavigation(page, async () => await page.locator('.kong-ui-entities-plugins-list [data-testid="new-plugin"]').click())
    await page.locator('[data-testid="Key Authentication"]').click()
    await page.waitForSelector('.entity-form')
    await withNavigation(page, async () => await page.click(routeListPage.$.submitButton))
    await expect(page.locator('.kong-ui-entities-plugins-list [data-testid="appliedTo"] .k-badge')).toContainText('Global')

    // Update plugin and scope it to consumer
    await withNavigation(page, () => clickEntityListAction(page, 'edit'))
    await page.waitForSelector('.entity-form')
    await page.click('.selection-group .Scoped-check')
    await page.click('#route-id')
    await page.fill('#route-id', mockRouteName)
    await page.waitForTimeout(300)
    await expect(page.locator('.k-select-item')).toContainText(mockRouteName)
    await page.click('.k-select-item')
    await page.click(routeListPage.$.submitButton)
    await withNavigation(page, () => page.click('.k-modal .k-button.primary'))
    await expect(page.locator('.kong-ui-entities-plugins-list [data-testid="appliedTo"] .k-badge')).toContainText('Route')
  })

  test('change scope from scoped to global', async ({ page, pluginListPage, routeListPage }) => {
    await page.waitForTimeout(100)
    await pluginListPage.goto()
    await expect(page.locator('.kong-ui-entities-plugins-list [data-testid="appliedTo"] .k-badge')).toContainText('Route')
    await withNavigation(page, () => clickEntityListAction(page, 'edit'))
    await page.waitForSelector('.entity-form')
    await page.click('.selection-group .Global-check')
    await page.click(routeListPage.$.submitButton)
    await withNavigation(page, () => page.click('.k-modal .k-button.primary'))
    await expect(page.locator('.kong-ui-entities-plugins-list [data-testid="appliedTo"] .k-badge')).toContainText('Global')
  })
})
