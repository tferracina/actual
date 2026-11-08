import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import { Checkbox } from '#components/forms';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

type Props = Extract<ModalType, { name: 'merchant-category' }>['options'];

export function MerchantCategoryModal({ preview, onApplied }: Props) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [includeCategorized, setIncludeCategorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const categorizedCount = preview.candidates.filter(t => !!t.category).length;
  const count =
    preview.candidates.length - (includeCategorized ? 0 : categorizedCount);
  const merchant = preview.payeeName;
  const category = preview.categoryName;

  return (
    <Modal name="merchant-category">
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Categorize other purchases?')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ maxWidth: 500, gap: 16, lineHeight: 1.5 }}>
            <Text>
              {t(
                'Use "{{category}}" for other purchases from "{{merchant}}"?',
                { category, merchant },
              )}
            </Text>
            <Text>{t('Other purchases to update: {{count}}', { count })}</Text>
            {categorizedCount > 0 && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Checkbox
                  id="merchant-include-categorized"
                  checked={includeCategorized}
                  disabled={saving}
                  onChange={e => setIncludeCategorized(e.target.checked)}
                />
                <label htmlFor="merchant-include-categorized">
                  <Trans>Include purchases that already have a category</Trans>
                </label>
              </View>
            )}
            <Text>
              <Trans>
                Matches the same payee across open budget accounts. Transfers,
                split transactions and reconciled purchases are excluded.
              </Trans>
            </Text>
            {error && (
              <Text role="alert">
                <Trans>
                  Could not update these purchases. Close this dialog and try
                  again.
                </Trans>
              </Text>
            )}
          </View>
          <ModalButtons>
            <Button isDisabled={saving} onPress={() => state.close()}>
              <Trans>Just this purchase</Trans>
            </Button>
            <Button
              variant="primary"
              isDisabled={saving || count === 0}
              onPress={async () => {
                setSaving(true);
                setError(false);
                try {
                  const result = await send(
                    'transactions-merchant-category-apply',
                    { preview, includeCategorized },
                  );
                  onApplied();
                  state.close();
                  dispatch(
                    addNotification({
                      notification: {
                        type: 'message',
                        message: t(
                          'Other purchases updated: {{count}}. You can undo this change.',
                          { count: result.updatedCount },
                        ),
                      },
                    }),
                  );
                } catch {
                  setError(true);
                  setSaving(false);
                }
              }}
            >
              <Trans>Apply to other purchases</Trans>
            </Button>
          </ModalButtons>
        </>
      )}
    </Modal>
  );
}
