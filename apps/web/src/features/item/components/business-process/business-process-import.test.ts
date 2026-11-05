import businessProcessFixture from '@docgraph/common/fixtures/business-process.json'
import { businessProcessSchema } from '@docgraph/common/schemas'
import { describe, expect, it } from 'vitest'
import { businessProcessImportSchema } from './business-process-import'

describe('businessProcessImportSchema', () => {
  it('rejects a containment cycle introduced by attachment normalization', () => {
    const document = JSON.parse(
      JSON.stringify(businessProcessFixture),
    ) as typeof businessProcessFixture
    const activity = document.nodes.find((node) => node.id === 'validate-order')
    if (!activity) throw new Error('Fixture activity missing')
    activity.parentId = 'boundary-timeout'

    expect(businessProcessSchema.safeParse(document).success).toBe(true)
    const normalized = businessProcessImportSchema.safeParse(document)

    expect(normalized.success).toBe(false)
    if (!normalized.success) {
      expect(
        normalized.error.issues.some((issue) => issue.message.includes('contain cycles')),
      ).toBe(true)
    }
  })
})
