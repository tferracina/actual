/** Conservative review gate. False positives stay uncategorized for the user. */
export function shouldReviewMerchant(merchant: string): boolean {
  return (
    /\b(virement|vir|bonifico|transfer|transfert|giroconto|repayment|remboursement|prelevement\s+amex)\b/i.test(
      merchant,
    ) ||
    /\b(card|carte|amex)\b.{0,30}\b(payment|paiement|bill|settlement)\b/i.test(
      merchant,
    ) ||
    /\b(ignore|instructions?|prompt|assistant|system\s+message|choose|category|categorize)\b/i.test(
      merchant,
    )
  );
}
