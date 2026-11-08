import * as db from '#server/db';
import type { TransactionEntity } from '#types/models';
import type { MerchantCategoryPreview } from '#types/models/merchant-category';

import { batchUpdateTransactions } from '.';

function isPurchase(transaction: TransactionEntity) {
  return (
    transaction.amount < 0 &&
    !transaction.transfer_id &&
    !transaction.is_parent &&
    !transaction.is_child &&
    !transaction.parent_id &&
    !transaction.reconciled &&
    !transaction.starting_balance_flag
  );
}

export async function previewMerchantCategory({
  sourceId,
}: {
  sourceId: string;
}): Promise<MerchantCategoryPreview | null> {
  const source = await db.getTransaction(sourceId);
  if (!source?.payee || !source.category || !isPurchase(source)) {
    return null;
  }
  const [payee, category, account] = await Promise.all([
    db.getPayee(source.payee),
    db.getCategory(source.category),
    db.getAccount(source.account),
  ]);
  if (
    !payee ||
    payee.tombstone ||
    payee.transfer_acct ||
    !category ||
    category.tombstone ||
    category.is_income ||
    !account ||
    account.tombstone ||
    account.offbudget ||
    account.closed
  ) {
    return null;
  }
  // v_transactions uses canonical payees, including merged payee mappings.
  const transactions = await db.selectWithSchema(
    'transactions',
    `SELECT t.* FROM v_transactions t JOIN accounts a ON a.id = t.account
     WHERE t.payee = ? AND t.id != ? AND a.tombstone = 0
       AND a.offbudget = 0 AND a.closed = 0`,
    [source.payee, source.id],
  );
  return {
    sourceId: source.id,
    payeeId: source.payee,
    payeeName: payee.name,
    categoryId: source.category,
    categoryName: category.name,
    candidates: transactions
      .filter(t => isPurchase(t) && t.category !== source.category)
      .map(t => ({ id: t.id, category: t.category ?? null })),
  };
}

export async function applyMerchantCategory({
  preview,
  includeCategorized = false,
}: {
  preview: MerchantCategoryPreview;
  includeCategorized?: boolean;
}) {
  // Re-read eligibility at confirmation: never overwrite a subsequent edit or newly imported row.
  const current = await previewMerchantCategory({ sourceId: preview.sourceId });
  if (
    !current ||
    current.payeeId !== preview.payeeId ||
    current.categoryId !== preview.categoryId
  ) {
    throw new Error(
      'The original purchase changed. Categorize it again to refresh the selection.',
    );
  }
  const expected = new Map(
    preview.candidates.map(t => [t.id, t.category ?? null]),
  );
  const updated = current.candidates
    .filter(
      t => expected.has(t.id) && expected.get(t.id) === (t.category ?? null),
    )
    .filter(t => includeCategorized || !t.category)
    .map(t => ({ id: t.id, category: current.categoryId }));
  if (updated.length) {
    await batchUpdateTransactions({
      updated,
      runTransfers: false,
      learnCategories: false,
    });
  }
  return { updatedCount: updated.length };
}
