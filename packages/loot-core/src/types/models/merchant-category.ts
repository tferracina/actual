import type { TransactionEntity } from './transaction';

export type MerchantCategoryCandidate = {
  id: TransactionEntity['id'];
  category: TransactionEntity['category'] | null;
};

export type MerchantCategoryPreview = {
  sourceId: string;
  payeeId: string;
  payeeName: string;
  categoryId: string;
  categoryName: string;
  candidates: MerchantCategoryCandidate[];
};
