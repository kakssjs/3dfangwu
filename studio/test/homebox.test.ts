import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entityUpdateFrom, itemDescription, roomDescription } from '../src/homebox.ts';
import type { Entity } from '../src/homebox.ts';
import type { HomeboxSent } from '../src/home-record.ts';

// An item as Homebox returns it, after the customer added their own details.
function sofaInHomebox(changes: Partial<Entity> = {}): Entity {
  return {
    id: 'e-sofa',
    name: '三人沙发',
    description: '来自装修设计 · 尺寸 3000×900 mm',
    quantity: 1,
    insured: true,
    archived: false,
    assetId: '000-012',
    purchasePrice: 4999,
    parent: { id: 'loc-living' },
    entityType: { id: 'type-item', isLocation: false },
    locationId: null,
    tags: [{ id: 'tag-1' }],
    fields: [{ id: 'f1', type: 'text', name: '颜色', textValue: '米白', numberValue: 0, booleanValue: false }],
    syncChildEntityLocations: false,
    serialNumber: 'SN-1',
    modelNumber: 'M-2',
    manufacturer: '某品牌',
    lifetimeWarranty: false,
    warrantyExpires: '2028-11-05',
    warrantyDetails: '整机两年',
    purchaseDate: '2026-11-01',
    purchaseFrom: '门店',
    soldDate: '',
    soldTo: '',
    soldPrice: 0,
    soldNotes: '',
    notes: '客户备注：靠窗',
    ...changes,
  };
}

const designed: HomeboxSent = {
  name: '三人沙发',
  description: '来自装修设计 · 尺寸 3000×900 mm',
  parentId: 'loc-living',
  purchasePrice: 4999,
};

test('nothing to send when Homebox already matches the design', () => {
  assert.equal(entityUpdateFrom(sofaInHomebox(), designed, designed), null);
  assert.equal(entityUpdateFrom(sofaInHomebox(), designed), null);
});

test('a design change is sent, and everything the customer added is sent back unchanged', () => {
  const update = entityUpdateFrom(sofaInHomebox(), { ...designed, name: '转角沙发', purchasePrice: 6999 }, designed);
  assert.ok(update);
  assert.equal(update.name, '转角沙发');
  assert.equal(update.purchasePrice, 6999);
  assert.equal(update.parentId, 'loc-living');
  assert.equal(update.notes, '客户备注：靠窗');
  assert.equal(update.assetId, '000-012');
  assert.equal(update.serialNumber, 'SN-1');
  assert.equal(update.warrantyExpires, '2028-11-05');
  assert.equal(update.insured, true);
  assert.equal(update.entityTypeId, 'type-item');
  assert.equal(update.locationId, undefined);
  assert.deepEqual(update.tagIds, ['tag-1']);
  assert.equal(update.fields[0]?.textValue, '米白');
});

test("the customer's own edits stay while the design hasn't changed that field", () => {
  const renamed = sofaInHomebox({ name: '客厅大沙发', parent: { id: 'loc-balcony' } });
  assert.equal(entityUpdateFrom(renamed, designed, designed), null);

  const update = entityUpdateFrom(renamed, { ...designed, purchasePrice: 5999 }, designed);
  assert.equal(update?.name, '客厅大沙发');
  assert.equal(update?.parentId, 'loc-balcony');
  assert.equal(update?.purchasePrice, 5999);
});

test('moving furniture to another room in the design moves it in Homebox', () => {
  const update = entityUpdateFrom(sofaInHomebox(), { ...designed, parentId: 'loc-balcony' }, designed);
  assert.equal(update?.parentId, 'loc-balcony');
});

test('without a design price, the price in Homebox is kept', () => {
  const { purchasePrice: _unused, ...noPrice } = designed;
  assert.equal(entityUpdateFrom(sofaInHomebox({ purchasePrice: 4500 }), noPrice), null);
});

test('descriptions say where the data came from', () => {
  assert.equal(roomDescription({ id: 'bay1', name: '主卧飘窗', areaM2: 0.97, counted: false }), '来自装修设计 · 面积约 0.97 m²（不计入面积）');
  assert.equal(
    itemDescription({ id: 'sofa-1', type: 'sofa', name: '三人沙发', roomId: 'living', roomGuessed: false, sizeMm: { w: 3000, d: 900 } }),
    '来自装修设计 · 尺寸 3000×900 mm',
  );
});
