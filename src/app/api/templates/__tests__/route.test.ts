import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockTemplate, mockTemplateLineItem } = vi.hoisted(() => {
  const mockTemplate = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  const mockTemplateLineItem = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  return { mockTemplate, mockTemplateLineItem }
})

vi.mock('@/lib/db', () => ({
  prisma: {
    template: mockTemplate,
    templateLineItem: mockTemplateLineItem,
  },
}))

import { GET as getTemplates, POST as postTemplate } from '../route'
import { GET as getTemplate, PATCH as patchTemplate, DELETE as deleteTemplate } from '../[templateId]/route'
import { POST as postLineItem } from '../[templateId]/line-items/route'
import { PATCH as patchLineItem, DELETE as deleteLineItem } from '../[templateId]/line-items/[lineItemId]/route'

const makeReq = (body?: unknown) =>
  new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

const tplParams = (templateId = 'tpl-1') =>
  ({ params: Promise.resolve({ templateId }) } as { params: Promise<{ templateId: string }> })

const liParams = (templateId = 'tpl-1', lineItemId = 'li-1') =>
  ({ params: Promise.resolve({ templateId, lineItemId }) } as { params: Promise<{ templateId: string; lineItemId: string }> })

beforeEach(() => vi.clearAllMocks())

const TEMPLATE = {
  id: 'tpl-1',
  name: 'Standard Independent',
  scaffoldType: 'independent',
  accessTypes: ['ground'],
  loadingClasses: ['light', 'medium'],
  _count: { lineItems: 2 },
}

const TEMPLATE_WITH_ITEMS = {
  ...TEMPLATE,
  lineItems: [
    { id: 'li-1', templateId: 'tpl-1', category: 'labour', description: 'Erect & dismantle', formula: 'area_m2 * height_m * 0.15', unit: 'hrs' },
  ],
}

describe('GET /api/templates', () => {
  it('returns template list with 200', async () => {
    mockTemplate.findMany.mockResolvedValue([TEMPLATE])
    const res = await getTemplates()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([TEMPLATE])
  })
})

describe('POST /api/templates', () => {
  it('creates template and returns 201', async () => {
    mockTemplate.create.mockResolvedValue({ ...TEMPLATE, _count: undefined })
    const req = makeReq({ name: 'Standard Independent', scaffoldType: 'independent', accessTypes: ['ground'], loadingClasses: ['light', 'medium'] })
    const res = await postTemplate(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing required fields', async () => {
    const req = makeReq({ name: 'Missing fields' })
    const res = await postTemplate(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: 'not-json', headers: { 'Content-Type': 'application/json' } })
    const res = await postTemplate(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/templates/[templateId]', () => {
  it('returns template with lineItems and 200', async () => {
    mockTemplate.findUnique.mockResolvedValue(TEMPLATE_WITH_ITEMS)
    const res = await getTemplate(new Request('http://localhost'), tplParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.lineItems).toHaveLength(1)
  })

  it('returns 404 for unknown template', async () => {
    mockTemplate.findUnique.mockResolvedValue(null)
    const res = await getTemplate(new Request('http://localhost'), tplParams('unknown'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/templates/[templateId]', () => {
  it('updates template name and returns 200', async () => {
    mockTemplate.update.mockResolvedValue({ ...TEMPLATE, name: 'Updated' })
    const req = makeReq({ name: 'Updated' })
    const res = await patchTemplate(req, tplParams())
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown template (P2025)', async () => {
    const { Prisma } = await import('@prisma/client')
    mockTemplate.update.mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError('', { code: 'P2025', clientVersion: '' }), {})
    )
    const req = makeReq({ name: 'x' })
    const res = await patchTemplate(req, tplParams('unknown'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/templates/[templateId]', () => {
  it('deletes and returns 204', async () => {
    mockTemplate.delete.mockResolvedValue({})
    const res = await deleteTemplate(new Request('http://localhost'), tplParams())
    expect(res.status).toBe(204)
  })

  it('returns 404 for unknown template (P2025)', async () => {
    const { Prisma } = await import('@prisma/client')
    mockTemplate.delete.mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError('', { code: 'P2025', clientVersion: '' }), {})
    )
    const res = await deleteTemplate(new Request('http://localhost'), tplParams('unknown'))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/templates/[templateId]/line-items', () => {
  it('creates line item and returns 201', async () => {
    mockTemplate.findUnique.mockResolvedValue({ id: 'tpl-1' })
    mockTemplateLineItem.create.mockResolvedValue({ id: 'li-2', templateId: 'tpl-1', category: 'labour', description: 'Test', formula: 'area_m2 * 0.1', unit: 'hrs' })
    const req = makeReq({ category: 'labour', description: 'Test', formula: 'area_m2 * 0.1', unit: 'hrs' })
    const res = await postLineItem(req, tplParams())
    expect(res.status).toBe(201)
  })

  it('returns 404 when template not found', async () => {
    mockTemplate.findUnique.mockResolvedValue(null)
    const req = makeReq({ category: 'labour', description: 'Test', formula: 'area_m2 * 0.1', unit: 'hrs' })
    const res = await postLineItem(req, tplParams('unknown'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/templates/[templateId]/line-items/[lineItemId]', () => {
  it('updates line item and returns 200', async () => {
    mockTemplateLineItem.update.mockResolvedValue({ id: 'li-1', formula: 'area_m2 * 0.2' })
    const req = makeReq({ formula: 'area_m2 * 0.2' })
    const res = await patchLineItem(req, liParams())
    expect(res.status).toBe(200)
  })

  it('returns 404 for unknown line item (P2025)', async () => {
    const { Prisma } = await import('@prisma/client')
    mockTemplateLineItem.update.mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError('', { code: 'P2025', clientVersion: '' }), {})
    )
    const req = makeReq({ formula: 'area_m2 * 0.2' })
    const res = await patchLineItem(req, liParams('tpl-1', 'unknown'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/templates/[templateId]/line-items/[lineItemId]', () => {
  it('deletes and returns 204', async () => {
    mockTemplateLineItem.delete.mockResolvedValue({})
    const res = await deleteLineItem(new Request('http://localhost'), liParams())
    expect(res.status).toBe(204)
  })

  it('returns 404 for unknown line item (P2025)', async () => {
    const { Prisma } = await import('@prisma/client')
    mockTemplateLineItem.delete.mockRejectedValue(
      Object.assign(new Prisma.PrismaClientKnownRequestError('', { code: 'P2025', clientVersion: '' }), {})
    )
    const res = await deleteLineItem(new Request('http://localhost'), liParams('tpl-1', 'unknown'))
    expect(res.status).toBe(404)
  })
})
