import type { Page } from '@playwright/test'
import { POM } from '.'

export class SniListPage extends POM {
  public $ = {
    ...super.$,
  }

  constructor (page: Page) {
    super(page, '/snis')
  }
}
