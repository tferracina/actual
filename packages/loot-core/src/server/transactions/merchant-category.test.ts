import * as db from '#server/db';
import type { TransactionEntity } from '#types/models';

import {
  applyMerchantCategory,
  previewMerchantCategory,
} from './merchant-category';

async function purchase(id: string, fields: Partial<TransactionEntity> = {}) {
  await db.insertTransaction({
    id,
    account: 'bank',
    date: '2026-10-01',
    amount: -1000,
    payee: 'merchant',
    notes: 'Keep this note',
    ...fields,
  });
}

beforeEach(global.emptyDatabase());
afterEach(global.emptyDatabase());
beforeEach(async () => {
  await db.insertAccount({ id: 'bank', name: 'Bank' });
  await db.insertAccount({ id: 'card', name: 'Card' });
  await db.insertAccount({
    id: 'investment',
    name: 'Investment',
    offbudget: 1,
  });
  await db.insertAccount({ id: 'closed', name: 'Closed', closed: 1 });
  await db.insertPayee({ id: 'merchant', name: 'Example shop' });
  await db.insertPayee({ id: 'other', name: 'Different shop' });
  await db.insertCategoryGroup({ id: 'group', name: 'Spending', is_income: 0 });
  await db.insertCategory({
    id: 'groceries',
    name: 'Groceries',
    cat_group: 'group',
    is_income: 0,
  });
  await db.insertCategory({
    id: 'shopping',
    name: 'Shopping',
    cat_group: 'group',
    is_income: 0,
  });
  await purchase('source', { category: 'groceries' });
});

it('previews exact-payee purchases across accounts, excluding protected and already matching rows', async () => {
  await purchase('empty');
  await purchase('card-purchase', { account: 'card', category: 'shopping' });
  await purchase('same-category', { category: 'groceries' });
  await purchase('different-merchant', { payee: 'other' });
  await purchase('refund', { amount: 1000 });
  await purchase('transfer', { transfer_id: 'other-leg' });
  await purchase('parent', { is_parent: true });
  await purchase('child', { is_child: true, parent_id: 'parent' });
  await purchase('reconciled', { reconciled: true });
  await purchase('opening', { starting_balance_flag: true });
  await purchase('offbudget', { account: 'investment' });
  await purchase('closed-account', { account: 'closed' });
  const preview = await previewMerchantCategory({ sourceId: 'source' });
  expect(preview?.candidates.map(t => t.id).sort()).toEqual([
    'card-purchase',
    'empty',
  ]);
  expect(preview?.payeeName).toBe('Example shop');
  expect((await db.getTransaction('empty')).category).toBeNull();
});

it('defaults to uncategorized purchases, preserving notes and explicit categories', async () => {
  await purchase('empty');
  await purchase('categorized', { category: 'shopping' });
  const preview = await previewMerchantCategory({ sourceId: 'source' });
  if (!preview) throw new Error('Missing preview');
  expect(await applyMerchantCategory({ preview })).toEqual({ updatedCount: 1 });
  expect(await db.getTransaction('empty')).toMatchObject({
    category: 'groceries',
    notes: 'Keep this note',
    amount: -1000,
  });
  expect((await db.getTransaction('categorized')).category).toBe('shopping');
});

it('includes existing categories only when requested', async () => {
  await purchase('categorized', { category: 'shopping' });
  const preview = await previewMerchantCategory({ sourceId: 'source' });
  if (!preview) throw new Error('Missing preview');
  expect(
    await applyMerchantCategory({ preview, includeCategorized: true }),
  ).toEqual({ updatedCount: 1 });
  expect((await db.getTransaction('categorized')).category).toBe('groceries');
});

it('does not overwrite later edits, newly imported purchases, or newly reconciled rows', async () => {
  await purchase('edited');
  await purchase('locked');
  await purchase('eligible');
  const preview = await previewMerchantCategory({ sourceId: 'source' });
  if (!preview) throw new Error('Missing preview');
  await db.updateTransaction({ id: 'edited', category: 'shopping' });
  await db.updateTransaction({ id: 'locked', reconciled: true });
  await purchase('newly-imported');
  expect(
    await applyMerchantCategory({ preview, includeCategorized: true }),
  ).toEqual({ updatedCount: 1 });
  expect((await db.getTransaction('edited')).category).toBe('shopping');
  expect((await db.getTransaction('locked')).category).toBeNull();
  expect((await db.getTransaction('newly-imported')).category).toBeNull();
});

it('rejects a stale source category and protected source transactions', async () => {
  await purchase('empty');
  const preview = await previewMerchantCategory({ sourceId: 'source' });
  if (!preview) throw new Error('Missing preview');
  await db.updateTransaction({ id: 'source', category: 'shopping' });
  await expect(applyMerchantCategory({ preview })).rejects.toThrow(
    'original purchase changed',
  );
  expect((await db.getTransaction('empty')).category).toBeNull();
  await db.updateTransaction({ id: 'source', reconciled: true });
  expect(await previewMerchantCategory({ sourceId: 'source' })).toBeNull();
});
