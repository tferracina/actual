import { send } from '@actual-app/core/platform/client/connection';
import type { MerchantCategoryPreview } from '@actual-app/core/types/models/merchant-category';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TestProviders } from '#mocks';

import { MerchantCategoryModal } from './MerchantCategoryModal';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(),
}));

const preview: MerchantCategoryPreview = {
  sourceId: 'source',
  payeeId: 'shop',
  payeeName: 'Test shop',
  categoryId: 'groceries',
  categoryName: 'Groceries',
  candidates: [
    { id: 'empty', category: null },
    { id: 'categorized', category: 'shopping' },
  ],
};
beforeEach(() => vi.clearAllMocks());

it('asks before updating and leaves already categorized purchases unchecked', async () => {
  const onApplied = vi.fn();
  vi.mocked(send).mockResolvedValue({ updatedCount: 1 });
  render(
    <TestProviders>
      <MerchantCategoryModal preview={preview} onApplied={onApplied} />
    </TestProviders>,
  );
  expect(screen.getByText('Other purchases to update: 1')).toBeInTheDocument();
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply to other purchases' }),
  );
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith('transactions-merchant-category-apply', {
      preview,
      includeCategorized: false,
    }),
  );
  expect(onApplied).toHaveBeenCalledOnce();
});

it('explicitly includes existing categories and updates the count', async () => {
  vi.mocked(send).mockResolvedValue({ updatedCount: 2 });
  render(
    <TestProviders>
      <MerchantCategoryModal preview={preview} onApplied={vi.fn()} />
    </TestProviders>,
  );
  await userEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('Other purchases to update: 2')).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply to other purchases' }),
  );
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith('transactions-merchant-category-apply', {
      preview,
      includeCategorized: true,
    }),
  );
});

it('cancel does not update other purchases', async () => {
  render(
    <TestProviders>
      <MerchantCategoryModal preview={preview} onApplied={vi.fn()} />
    </TestProviders>,
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Just this purchase' }),
  );
  expect(send).not.toHaveBeenCalled();
});

it('keeps the dialog open and reports an apply failure', async () => {
  vi.mocked(send).mockRejectedValue(new Error('stale source'));
  const onApplied = vi.fn();
  render(
    <TestProviders>
      <MerchantCategoryModal preview={preview} onApplied={onApplied} />
    </TestProviders>,
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Apply to other purchases' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not update these purchases',
  );
  expect(onApplied).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Apply to other purchases' }),
  ).toBeEnabled();
});
